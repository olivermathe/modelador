import type { ReactNode } from 'react'
import { ELEMENT_TYPE_ORDER, ELEMENT_TYPES, SHAPE_KIND_ORDER, SHAPE_KINDS } from '@/model/elementTypes'
import { useModel } from '@/model/store'
import { setDragPayload } from './dnd'
import { RelTypeGrid } from './RelTypePicker'
import { Tooltip } from './Tooltip'

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }): JSX.Element {
  return (
    <section className="border-b border-slate-100 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="mb-2 mt-0.5 text-[11px] text-slate-400">{hint}</p>
      {children}
    </section>
  )
}

/** Itens que o usuário arrasta ou escolhe para montar o desenho. */
export function Palette(): JSX.Element {
  const newRelType = useModel((s) => s.newRelType)
  const setNewRelType = useModel((s) => s.setNewRelType)
  const setTool = useModel((s) => s.setTool)

  return (
    <div>
      <Section title="Novo recurso" hint="Arraste para o desenho. O arquivo é criado em aplicações/ ao salvar.">
        <div className="grid grid-cols-6 gap-1.5">
          {[...ELEMENT_TYPE_ORDER, 'endpoint' as const].map((type) => {
            const info = ELEMENT_TYPES[type]
            const Icon = info.icon
            return (
              <Tooltip key={type} label={info.label} detail="Arraste para o desenho">
                <div
                  draggable
                  onDragStart={(e) => setDragPayload(e, { kind: 'new', type })}
                  className="flex h-10 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:cursor-grabbing"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </Tooltip>
            )
          })}
        </div>
      </Section>

      <Section title="Formas" hint="Arraste para o desenho. Existem só neste desenho.">
        <div className="grid grid-cols-5 gap-1.5">
          {SHAPE_KIND_ORDER.map((kind) => {
            const info = SHAPE_KINDS[kind]
            const Icon = info.icon
            return (
              <Tooltip key={kind} label={info.label} detail="Arraste para o desenho">
                <div
                  draggable
                  onDragStart={(e) => setDragPayload(e, { kind: 'shape', shape: kind })}
                  className="flex h-10 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 active:cursor-grabbing"
                >
                  <Icon className="h-5 w-5" />
                </div>
              </Tooltip>
            )
          })}
        </div>
      </Section>

      <Section title="Nova ligação" hint="Escolher um tipo ativa a ferramenta Ligar (L): os pontos de conexão aparecem nos recursos.">
        <RelTypeGrid
          value={newRelType}
          onPick={(relType) => {
            setNewRelType(relType)
            setTool('connect')
          }}
        />
      </Section>
    </div>
  )
}
