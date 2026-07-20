# Codewright Agent Instructions

Este projeto usa o Codewright para desenvolvimento assistido.

## Fluxo

1. Ideia → execute `codewright:spec`
2. Spec pronto → execute `codewright:architecture`
3. Arquitetura pronta → execute `codewright:story`
4. Story pronta → execute `codewright:dev`
5. Implementado → execute `codewright:review`

## Regras

- Toda implementação começa com uma spec aprovada
- Toda história tem I/O Matrix com edge cases
- Tarefa só é completa com testes passando
- Nunca implementar fora do escopo da task
