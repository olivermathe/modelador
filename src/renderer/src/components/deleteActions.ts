import { useModel } from '@/model/store'

type Target = { kind: 'resource' | 'relation'; id: string }

/**
 * Exclusão permanente (Shift+Delete, menu de contexto, botão do painel): pergunta antes.
 * A exclusão comum (Delete) só tira do desenho aberto e não passa por aqui.
 */
export function askPermanentDelete(targets: Target[]): void {
  const { resources, relations, technologies, diagrams, ask, deleteResource, deleteRelation } = useModel.getState()
  const plural = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${many}`)
  const resourceIds = targets.filter((t) => t.kind === 'resource' && resources[t.id]).map((t) => t.id)
  const relationIds = targets.filter((t) => t.kind === 'relation' && relations[t.id]).map((t) => t.id)
  if (!resourceIds.length && !relationIds.length) return
  const run = (): void => {
    const { deleteResource: delRes, deleteRelation: delRel } = useModel.getState()
    relationIds.forEach((id) => useModel.getState().relations[id] && delRel(id))
    resourceIds.forEach((id) => delRes(id))
  }
  const tail = 'Para só tirar deste desenho, use Delete. Dá para desfazer com Ctrl+Z.'

  // Um item só: mensagem com o nome dele
  if (resourceIds.length === 1 && !relationIds.length) {
    const resource = resources[resourceIds[0]]
    const links = Object.values(relations).filter((r) => r.sourceId === resource.id || r.targetId === resource.id).length
    const used = Object.values(diagrams).filter((d) => d.nodes.some((n) => n.resourceId === resource.id)).length
    return ask({
      title: `Excluir "${resource.name}" permanentemente?`,
      message: `Ele sai de ${plural(used, 'desenho', 'desenhos')} e o arquivo é apagado ao salvar, junto com ${plural(links, 'ligação', 'ligações')} dele. ${tail}`,
      options: [{ label: 'Excluir permanentemente', danger: true, run: () => deleteResource(resource.id) }]
    })
  }
  if (relationIds.length === 1 && !resourceIds.length) {
    const relation = relations[relationIds[0]]
    const name = (id: string): string => resources[id]?.name ?? technologies[id]?.name ?? '?'
    const used = Object.values(diagrams).filter((d) => d.edges.includes(relation.id)).length
    return ask({
      title: 'Excluir a ligação permanentemente?',
      message: `${name(relation.sourceId)} → ${name(relation.targetId)}. Ela sai de ${plural(used, 'desenho', 'desenhos')} e o arquivo é apagado ao salvar. ${tail}`,
      options: [{ label: 'Excluir permanentemente', danger: true, run: () => deleteRelation(relation.id) }]
    })
  }

  // Vários itens
  const parts = [
    resourceIds.length && plural(resourceIds.length, 'recurso', 'recursos'),
    relationIds.length && plural(relationIds.length, 'ligação', 'ligações')
  ].filter(Boolean)
  ask({
    title: `Excluir ${parts.join(' e ')} permanentemente?`,
    message: `Saem de todos os desenhos e os arquivos são apagados ao salvar (as ligações dos recursos vão junto). ${tail}`,
    options: [{ label: 'Excluir permanentemente', danger: true, run }]
  })
}
