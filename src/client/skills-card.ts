/**
 * "应用技能" card: the per-app notes the agent keeps (see ../skills.ts). The
 * user can read, edit, add and delete them here; built-in skills can be
 * overridden and restored.
 */
import * as React from 'react'

const SKILLS_ROUTE = '/api/dsh-computer-use/skills'
const MAX_CHARS = 4000
const h = React.createElement

interface Skill { id: string; app: string; match: string[]; summary: string; content: string; source: 'builtin' | 'user'; overrides: boolean; updatedAt: number }
interface SkillsBody { ok: boolean; error?: string; dir?: string; skills?: Skill[] }
interface Draft { id: string; app: string; match: string; summary: string; content: string; isNew: boolean }

export function SkillsCard({ S }: { S: Record<string, React.CSSProperties> }): React.ReactElement {
  const [skills, setSkills] = React.useState<Skill[] | null>(null)
  const [dir, setDir] = React.useState('')
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const call = React.useCallback(async (body?: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    try {
      const response = await fetch(SKILLS_ROUTE, body
        ? { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : { credentials: 'same-origin' })
      const result = await response.json() as SkillsBody
      if (!result.ok) throw new Error(result.error ?? 'Request failed')
      setSkills(result.skills ?? [])
      setDir(result.dir ?? '')
      return true
    } catch (error) {
      setNote({ kind: 'error', text: (error as Error).message })
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  React.useEffect(() => { void call() }, [call])

  const edit = (skill: Skill): void => {
    setNote(null)
    setDraft({ id: skill.id, app: skill.app, match: skill.match.join(', '), summary: skill.summary, content: skill.content, isNew: false })
  }
  const save = async (): Promise<void> => {
    if (!draft) return
    setNote(null)
    const ok = await call({ op: 'save', id: draft.isNew ? '' : draft.id, app: draft.app, match: draft.match, summary: draft.summary, content: draft.content })
    if (ok) { setDraft(null); setNote({ kind: 'ok', text: 'Saved' }) }
  }
  const remove = async (skill: Skill): Promise<void> => {
    setNote(null)
    if (await call({ op: 'delete', id: skill.id })) { if (draft?.id === skill.id) setDraft(null); setNote({ kind: 'ok', text: `Deleted "${skill.app}"` }) }
  }
  const reset = async (skill: Skill): Promise<void> => {
    setNote(null)
    if (await call({ op: 'reset', id: skill.id })) { if (draft?.id === skill.id) setDraft(null); setNote({ kind: 'ok', text: `Restored the built-in version of "${skill.app}"` }) }
  }

  const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.18))' }
  const small: React.CSSProperties = { ...S.secondary, padding: '4px 10px', fontSize: 12 }
  const tag: React.CSSProperties = { fontSize: 11, padding: '1px 7px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', color: 'var(--dsw-alias-label-tertiary, #888)', whiteSpace: 'nowrap' }
  const invalid = draft !== null && (draft.app.trim() === '' || draft.content.trim() === '' || draft.content.length > MAX_CHARS)

  return h('section', { style: S.card },
    h('h3', { style: S.cardTitle }, 'App skills'),
    h('p', { style: S.hint }, 'Operating notes the AI keeps for each app: one per app. After working out an unfamiliar app, the AI records it and reads it automatically the next time the app opens, without using the system prompt. You can view, edit, delete or create them here.'),
    skills === null ? h('p', { style: S.hint }, busy ? 'Loading…' : 'Could not load app skills.')
      : skills.length === 0 ? h('p', { style: S.hint }, 'No app skills yet.')
        : h('div', null, ...skills.map(skill => h('div', { key: skill.id, style: row },
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' } },
              skill.app,
              h('span', { style: tag }, skill.source === 'builtin' ? 'Built-in' : skill.overrides ? 'Modified' : 'AI / custom'),
            ),
            h('div', { style: { ...S.hint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${skill.summary || '(no summary)'} · ${skill.content.length} chars`),
          ),
          h('button', { type: 'button', style: small, disabled: busy, onClick: () => edit(skill) }, 'View / edit'),
          skill.overrides ? h('button', { type: 'button', style: small, disabled: busy, onClick: () => { void reset(skill) } }, 'Restore built-in') : null,
          h('button', { type: 'button', style: small, disabled: busy, onClick: () => { void remove(skill) } }, 'Delete'),
        ))),
    draft === null ? null : h('div', { style: { display: 'grid', gap: 10, paddingTop: 4 } },
      h('div', { style: S.grid2 },
        h('label', { style: S.label }, 'App name',
          h('input', { style: S.input, value: draft.app, disabled: !draft.isNew, maxLength: 60, placeholder: 'e.g. Obsidian', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, app: e.target.value }) })),
        h('label', { style: S.label }, 'Matching programs (comma-separated)',
          h('input', { style: S.input, value: draft.match, maxLength: 200, placeholder: 'e.g. Obsidian, obsidian.exe', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, match: e.target.value }) })),
      ),
      h('label', { style: S.label }, 'Summary',
        h('input', { style: S.input, value: draft.summary, maxLength: 80, placeholder: 'A few words on what this skill covers', onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, summary: e.target.value }) })),
      h('label', { style: S.label }, `Content (${draft.content.length} / ${MAX_CHARS} chars)`,
        h('textarea', {
          style: { ...S.input, minHeight: 200, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }, value: draft.content,
          placeholder: '- One operating rule per line: where to start, shortcuts, pitfalls',
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, content: e.target.value }),
        })),
      h('div', { style: S.actions },
        h('button', { type: 'button', style: { ...S.primary, opacity: busy || invalid ? 0.5 : 1 }, disabled: busy || invalid, onClick: () => { void save() } }, 'Save skill'),
        h('button', { type: 'button', style: S.secondary, disabled: busy, onClick: () => setDraft(null) }, 'Cancel'),
        draft.content.length > MAX_CHARS ? h('span', { style: S.error }, 'Content is too long; shorten it') : null,
      ),
    ),
    h('div', { style: S.actions },
      draft === null ? h('button', { type: 'button', style: S.secondary, disabled: busy, onClick: () => { setNote(null); setDraft({ id: '', app: '', match: '', summary: '', content: '', isNew: true }) } }, 'New skill') : null,
      h('button', { type: 'button', style: S.secondary, disabled: busy, onClick: () => { void call() } }, 'Refresh'),
      note === null ? null : h('span', { style: note.kind === 'ok' ? S.ok : S.error }, note.text),
    ),
    dir ? h('p', { style: S.hint }, `Saved in: ${dir} (one .md file per app; you can also edit them directly in an editor). After deleting a built-in skill, create a new one with the same name to re-enable it.`) : null,
  )
}
