/**
 * Agent Pool — manages concurrent agent execution with backpressure.
 * Ensures no more than maxConcurrent agents run simultaneously.
 */

import type { StoryAgentManifest, ManifestProgress } from "../agents/manifest.js";
import type { AgentResult, DevelopOptions } from "./agent-types.js";
import { spawnStoryAgent, type SpawnedAgent, getAgentProgress } from "./agent-spawner.js";

export interface PoolConfig {
  maxConcurrent: number;
  onAgentStart?: (id: string, storyId: string) => void;
  onAgentComplete?: (result: AgentResult) => void;
  onAgentError?: (id: string, storyId: string, error: string) => void;
  onProgress?: (id: string, progress: ManifestProgress) => void;
}

interface RunningAgent {
  spawned: SpawnedAgent;
  result: Promise<AgentResult>;
}

export class AgentPool {
  private config: PoolConfig;
  private running: Map<string, RunningAgent> = new Map();
  private queue: Array<{ manifest: StoryAgentManifest; resolve: (r: AgentResult) => void; reject: (e: Error) => void }> = [];
  private cwd: string;

  constructor(cwd: string, config: PoolConfig) {
    this.cwd = cwd;
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 4,
      onAgentStart: config.onAgentStart,
      onAgentComplete: config.onAgentComplete,
      onAgentError: config.onAgentError,
      onProgress: config.onProgress,
    };
  }

  /**
   * Submit a single manifest for execution.
   * If max concurrent agents reached, queues the request.
   */
  async submit(manifest: StoryAgentManifest): Promise<AgentResult> {
    // If we have capacity, run immediately
    if (this.running.size < this.config.maxConcurrent) {
      return this.runAgent(manifest);
    }

    // Otherwise, queue
    return new Promise((resolve, reject) => {
      this.queue.push({ manifest, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Submit multiple manifests for parallel execution.
   * Respects maxConcurrent limit automatically.
   */
  async submitAll(manifests: StoryAgentManifest[]): Promise<AgentResult[]> {
    return Promise.all(manifests.map(m => this.submit(m)));
  }

  /**
   * Wait for all currently running agents to complete.
   */
  async drain(): Promise<void> {
    const runningPromises = Array.from(this.running.values()).map(a => a.result);
    await Promise.all(runningPromises);
  }

  /**
   * Abort all running agents.
   */
  abort(): void {
    for (const [id, agent] of this.running) {
      agent.spawned.process.kill();
    }
    this.running.clear();
    this.queue = [];
  }

  private async runAgent(manifest: StoryAgentManifest): Promise<AgentResult> {
    const startTime = new Date().toISOString();
    this.config.onAgentStart?.(manifest.id, manifest.storyId);

    const spawned = spawnStoryAgent(manifest, {
      cwd: this.cwd,
      onStdout: (data) => {
        // Could stream to console or log file
      },
      onStderr: (data) => {
        // Log errors
      },
    });

    const resultPromise = new Promise<AgentResult>((resolve, reject) => {
      spawned.process.on("close", (code) => {
        const endTime = new Date().toISOString();
        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

        // Read final progress
        const progress = getAgentProgress(this.cwd, manifest.id);

        const result: AgentResult = {
          id: manifest.id,
          storyId: manifest.storyId,
          specSlug: manifest.specSlug,
          exitCode: code ?? 0,
          stdout: "", // collected via onStdout callback
          stderr: "", // collected via onStderr callback
          success: code === 0,
          startedAt: startTime,
          completedAt: endTime,
          durationMs,
        };

        this.running.delete(manifest.id);
        this.config.onAgentComplete?.(result);
        this.processQueue();

        resolve(result);
      });

      spawned.process.on("error", (err) => {
        const endTime = new Date().toISOString();
        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

        const result: AgentResult = {
          id: manifest.id,
          storyId: manifest.storyId,
          specSlug: manifest.specSlug,
          exitCode: 1,
          stdout: "",
          stderr: err.message,
          success: false,
          startedAt: startTime,
          completedAt: endTime,
          durationMs,
        };

        this.running.delete(manifest.id);
        this.config.onAgentError?.(manifest.id, manifest.storyId, err.message);
        this.config.onAgentComplete?.(result);
        this.processQueue();

        reject(err);
      });
    });

    this.running.set(manifest.id, { spawned, result: resultPromise });
    return resultPromise;
  }

  private processQueue(): void {
    // Process queued agents as slots become available
    while (
      this.running.size < this.config.maxConcurrent &&
      this.queue.length > 0
    ) {
      const next = this.queue.shift()!;
      // Fire and forget — result handled via promise
      this.runAgent(next.manifest)
        .then(next.resolve)
        .catch(next.reject);
    }
  }
}
