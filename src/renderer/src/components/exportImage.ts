import { getNodesBounds, useReactFlow } from '@xyflow/react'
import { toJpeg } from 'html-to-image'
import { useCallback } from 'react'
import { fileStem } from '@/model/repo'
import { useModel } from '@/model/store'

const PADDING = 40

/** Exporta o desenho aberto inteiro (não só a parte visível) como JPEG. */
export function useExportJpeg(): () => Promise<void> {
  const { getNodes } = useReactFlow()

  return useCallback(async () => {
    const { activeDiagram, diagrams, select } = useModel.getState()
    if (!activeDiagram || !diagrams[activeDiagram]) return
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    const nodes = getNodes()
    if (!viewport || nodes.length === 0) return alert('O desenho está vazio.')

    // Sem seleção: a imagem não leva contornos azuis nem alças de redimensionar
    select(null)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const bounds = getNodesBounds(nodes)
    const width = Math.ceil(bounds.width + PADDING * 2)
    const height = Math.ceil(bounds.height + PADDING * 2)
    try {
      const dataUrl = await toJpeg(viewport, {
        backgroundColor: '#ffffff',
        quality: 0.95,
        pixelRatio: 2,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`
        },
        // Conectores (bolinhas) só servem para editar
        filter: (el) => !(el instanceof HTMLElement && el.classList.contains('react-flow__handle'))
      })
      await window.api.exportImage(dataUrl, `${fileStem(activeDiagram)}.jpg`)
    } catch (error) {
      alert(`Não foi possível exportar a imagem.\n\n${(error as Error).message}`)
    }
  }, [getNodes])
}
