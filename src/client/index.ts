/**
 * Browser half: the "电脑控制" (Computer use) section in Settings. It reads the
 * plugin's own Loader entry through `remote.settings.describe()` and writes
 * with `remote.settings.mutate()`; every field is volatile, so a save reaches
 * the next action without a restart. Live status and the overlay preview come
 * from the host routes in ../routes.ts.
 */
import * as React from 'react'
import { DEFAULTS, ENTRY_ID, resolveConfig } from '../settings.js'
import type { Settings } from '../computer.js'
import { ACCENT, ACCENT_INK, AccentPicker, installAccent } from './accent.js'
import { registerNavIcon } from './nav-icon.js'
import { Select, selectCss } from './select.js'
import { SkillsCard } from './skills-card.js'

const STATUS_ROUTE = '/api/dsh-computer-use/status'
const SCREENSHOTS_ROUTE = '/api/dsh-computer-use/screenshots'
const SCREENSHOTS_CLEAN_ROUTE = '/api/dsh-computer-use/screenshots/clean'

interface CacheStats { ok: boolean; error?: string; count: number; bytes: number; orphans: number; orphanBytes: number; removed?: number }

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
const PREVIEW_ROUTE = '/api/dsh-computer-use/preview'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code?: string; message: string } }
interface NamespaceView { ns: string; value: unknown; revision: number }

interface ClientContext {
  effect(execute: () => (() => void) | void, label?: string): void
  slots: {
    inject(name: string, register: () => unknown): void
    register(meta: Record<string, unknown>, render: (props: unknown) => unknown): unknown
  }
  remote: {
    $on?(event: string, listener: (...args: unknown[]) => void): () => void
    settings: {
      describe(): Promise<RemoteResult<{ writable: boolean; namespaces: NamespaceView[] }>>
      mutate(ns: string, ops: { op: 'set' | 'unset'; path: string[]; value?: unknown }[], expectedRevision?: number): Promise<RemoteResult<unknown>>
    }
  }
}

interface Status {
  helper: 'ready' | 'error'
  error?: string
  platform: string
  controlling: boolean
  displays: Array<{ width: number; height: number; dpi: number; primary: boolean; shot: { width: number; height: number } }>
}

/** Form state: numbers and lists as text so half-typed values do not jump. */
interface Draft {
  accessMode: Settings['accessMode']
  blockedApps: string
  overlay: boolean
  overlayLabel: string
  hostWindow: Settings['hostWindow']
  cardOpacity: number
  typingMode: Settings['typingMode']
  quickSteps: boolean
  pauseOnUserInput: boolean
  userIdleMs: string
  autoScreenshot: boolean
  settleMs: string
  maxLongEdge: string
  maxMegapixels: string
  jpegQuality: string
  naturalMouse: boolean
  mouseSpeed: string
  mouseJitter: string
  naturalScroll: boolean
  scrollNotchMs: string
  naturalTyping: boolean
  typingMinMs: string
  typingMaxMs: string
  typingErrorPct: string
}

const h = React.createElement

function draftFrom(value: unknown): Draft {
  const s = resolveConfig(value)
  return {
    accessMode: s.accessMode,
    blockedApps: s.blockedApps.join('\n'),
    overlay: s.overlay,
    overlayLabel: s.overlayLabel,
    hostWindow: s.hostWindow,
    cardOpacity: s.cardOpacity,
    typingMode: s.typingMode,
    quickSteps: s.quickSteps,
    pauseOnUserInput: s.pauseOnUserInput,
    userIdleMs: String(s.userIdleMs),
    autoScreenshot: s.autoScreenshot,
    settleMs: String(s.settleMs),
    maxLongEdge: String(s.maxLongEdge),
    maxMegapixels: String(Math.round(s.maxPixels / 10_000) / 100),
    jpegQuality: String(s.jpegQuality),
    naturalMouse: s.naturalMouse,
    mouseSpeed: String(s.mouseSpeed),
    mouseJitter: String(s.mouseJitter),
    naturalScroll: s.naturalScroll,
    scrollNotchMs: String(s.scrollNotchMs),
    naturalTyping: s.naturalTyping,
    typingMinMs: String(s.typingMinMs),
    typingMaxMs: String(s.typingMaxMs),
    typingErrorPct: String(s.typingErrorPct),
  }
}

/** Range-checked numbers; returns field errors keyed by Draft field. */
function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {}
  const check = (key: keyof Draft, min: number, max: number) => {
    const n = Number(d[key])
    if (String(d[key]).trim() === '' || !Number.isFinite(n) || n < min || n > max) errors[key] = `${min} – ${max}`
  }
  check('userIdleMs', 300, 10_000)
  check('settleMs', 0, 5000)
  check('maxLongEdge', 640, 3840)
  check('maxMegapixels', 0.3, 8)
  check('jpegQuality', 30, 100)
  check('mouseSpeed', 200, 6000)
  check('mouseJitter', 0, 100)
  check('scrollNotchMs', 10, 400)
  check('typingMinMs', 8, 300)
  check('typingMaxMs', 20, 600)
  check('typingErrorPct', 0, 25)
  if (!errors.typingMinMs && !errors.typingMaxMs && Number(d.typingMaxMs) < Number(d.typingMinMs) + 12) errors.typingMaxMs = '≥ min + 12'
  return errors
}

function valuesFrom(d: Draft): Record<string, unknown> {
  return {
    accessMode: d.accessMode,
    blockedApps: d.blockedApps.split(/[\n,，]/).map(item => item.trim()).filter(Boolean),
    overlay: d.overlay,
    overlayLabel: d.overlayLabel.trim() || DEFAULTS.overlayLabel,
    hostWindow: d.hostWindow,
    cardOpacity: d.cardOpacity,
    typingMode: d.typingMode,
    quickSteps: d.quickSteps,
    pauseOnUserInput: d.pauseOnUserInput,
    userIdleMs: Math.round(Number(d.userIdleMs)),
    autoScreenshot: d.autoScreenshot,
    settleMs: Math.round(Number(d.settleMs)),
    maxLongEdge: Math.round(Number(d.maxLongEdge)),
    maxPixels: Math.round(Number(d.maxMegapixels) * 1_000_000),
    jpegQuality: Math.round(Number(d.jpegQuality)),
    naturalMouse: d.naturalMouse,
    mouseSpeed: Math.round(Number(d.mouseSpeed)),
    mouseJitter: Math.round(Number(d.mouseJitter)),
    naturalScroll: d.naturalScroll,
    scrollNotchMs: Math.round(Number(d.scrollNotchMs)),
    naturalTyping: d.naturalTyping,
    typingMinMs: Math.round(Number(d.typingMinMs)),
    typingMaxMs: Math.round(Number(d.typingMaxMs)),
    typingErrorPct: Math.round(Number(d.typingErrorPct)),
  }
}

const S: Record<string, React.CSSProperties> = {
  page: { display: 'grid', gap: 20, maxWidth: 880, paddingBottom: 32, color: 'var(--dsw-alias-label-primary, inherit)' },
  title: { margin: 0, fontSize: 20, fontWeight: 600 },
  subtitle: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary, #666)' },
  card: { display: 'grid', gap: 14, padding: 16, borderRadius: 'var(--dsw-radius-lg, 12px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 600 },
  hint: { margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--dsw-alias-label-tertiary, #888)' },
  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 500 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  input: { boxSizing: 'border-box', width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit' },
  toggleRow: { display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' },
  toggleText: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 500 },
  error: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary, #d33)' },
  ok: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary, #2a2)' },
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  primary: { padding: '7px 16px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: `1px solid ${ACCENT}`, background: ACCENT, color: ACCENT_INK, cursor: 'pointer' },
  secondary: { padding: '7px 14px', fontSize: 13, borderRadius: 'var(--dsw-radius-md, 8px)', border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))', background: 'transparent', color: 'inherit', cursor: 'pointer' },
  statusLine: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, flex: '0 0 auto' },
}

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange(value: boolean): void }) {
  return h('button', {
    type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label, disabled,
    onClick: () => onChange(!checked),
    style: {
      flex: '0 0 auto', width: 40, height: 22, borderRadius: 11, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer',
      background: checked ? ACCENT : 'var(--dsw-alias-border-l3, rgba(127,127,127,.35))', opacity: disabled ? 0.5 : 1, transition: 'background .15s',
    },
  }, h('span', { style: { display: 'block', width: 18, height: 18, borderRadius: 9, background: checked ? ACCENT_INK : '#fff', transform: checked ? 'translateX(18px)' : 'none', transition: 'transform .15s' } }))
}

function ToggleRow({ title, hint, checked, disabled, onChange }: { title: string; hint: string; checked: boolean; disabled: boolean; onChange(value: boolean): void }) {
  return h('div', { style: S.toggleRow },
    h('div', { style: S.toggleText }, title, h('span', { style: { ...S.hint, fontWeight: 400 } }, hint)),
    h(Switch, { checked, disabled, label: title, onChange }),
  )
}

function NumberField({ label, unit, value, error, disabled, onChange }: { label: string; unit: string; value: string; error: string | undefined; disabled: boolean; onChange(value: string): void }) {
  return h('label', { style: S.label },
    label,
    h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
      h('input', { style: S.input, inputMode: 'decimal', value, disabled, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }),
      h('span', { style: { ...S.hint, whiteSpace: 'nowrap' } }, unit),
    ),
    error === undefined ? null : h('span', { style: S.error }, `Range ${error}`),
  )
}

function ComputerUseSection({ ctx }: { ctx: ClientContext }) {
  const [loaded, setLoaded] = React.useState(false)
  const [writable, setWritable] = React.useState(false)
  const [view, setView] = React.useState<NamespaceView | undefined>(undefined)
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom(undefined))
  const [dirty, setDirty] = React.useState(false)
  const dirtyRef = React.useRef(false)
  dirtyRef.current = dirty
  const draftRef = React.useRef(draft)
  draftRef.current = draft
  const [saving, setSaving] = React.useState(false)
  /** The draft whose save failed: not retried until it is edited again. */
  const [failed, setFailed] = React.useState<Draft | null>(null)
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [status, setStatus] = React.useState<Status | null>(null)
  const [cache, setCache] = React.useState<CacheStats | null>(null)
  const [cacheBusy, setCacheBusy] = React.useState(false)
  const [cacheNote, setCacheNote] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = React.useCallback(async (reset: boolean) => {
    try {
      const result = await ctx.remote.settings.describe()
      if (!result.ok) throw new Error(result.error.message)
      const found = result.value.namespaces.find(item => item.ns === ENTRY_ID)
      setWritable(result.value.writable)
      setView(found)
      if (reset || !dirtyRef.current) {
        // Keep the text as typed when it already means the stored values (a trailing newline in a list, say).
        const stored = draftFrom(found?.value)
        if (reset || JSON.stringify(valuesFrom(stored)) !== JSON.stringify(valuesFrom(draftRef.current))) setDraft(stored)
        setDirty(false)
      }
    } catch (error) {
      setMessage({ kind: 'error', text: `Failed to read settings: ${(error as Error).message}` })
    } finally {
      setLoaded(true)
    }
  }, [ctx])

  const refreshStatus = React.useCallback(async () => {
    try {
      const response = await fetch(STATUS_ROUTE, { credentials: 'same-origin' })
      setStatus(await response.json() as Status)
    } catch {
      setStatus(null)
    }
  }, [])

  const refreshCache = React.useCallback(async () => {
    setCacheBusy(true)
    try {
      const response = await fetch(SCREENSHOTS_ROUTE, { credentials: 'same-origin' })
      setCache(await response.json() as CacheStats)
    } catch {
      setCache(null)
    } finally {
      setCacheBusy(false)
    }
  }, [])

  const cleanCache = async () => {
    setCacheBusy(true)
    setCacheNote(null)
    try {
      const response = await fetch(SCREENSHOTS_CLEAN_ROUTE, { method: 'POST', credentials: 'same-origin' })
      const result = await response.json() as CacheStats & { bytes: number }
      if (!result.ok) throw new Error(result.error ?? 'Cleanup failed')
      setCacheNote({ kind: 'ok', text: result.removed ? `Cleaned up ${result.removed} screenshots` : 'No screenshots to clean up' })
      await refreshCache()
    } catch (error) {
      setCacheNote({ kind: 'error', text: `Cleanup failed: ${(error as Error).message}` })
    } finally {
      setCacheBusy(false)
    }
  }

  React.useEffect(() => {
    void load(true)
    void refreshStatus()
    void refreshCache()
    return ctx.remote.$on?.('settings/document-updated', (ns: unknown) => { if (ns === ENTRY_ID) { void load(false); void refreshStatus() } }) ?? undefined
  }, [ctx, load, refreshStatus])

  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }))
    setDirty(true)
    setMessage(null)
  }

  const errors = validate(draft)
  const invalid = Object.keys(errors).length > 0
  const disabled = !writable || view === undefined

  const save = async () => {
    if (view === undefined || invalid) return
    setSaving(true)
    const saved = draft
    try {
      const values = valuesFrom(saved)
      const result = await ctx.remote.settings.mutate(ENTRY_ID, Object.entries(values).map(([key, value]) => ({ op: 'set' as const, path: [key], value })), view.revision)
      if (!result.ok) throw new Error(result.error.message)
      setMessage({ kind: 'ok', text: 'Saved automatically; takes effect on the next action' })
      // Edits made while the request was in flight stay dirty and go out in the next save.
      if (draftRef.current === saved) { dirtyRef.current = false; setDirty(false) }
      await load(false)
      void refreshStatus()
    } catch (error) {
      setFailed(saved)
      setMessage({ kind: 'error', text: `Save failed: ${(error as Error).message}` })
    } finally {
      setSaving(false)
    }
  }

  // Every change saves itself: a switch that silently needs a Save button at the bottom of a long page gets lost.
  React.useEffect(() => {
    if (!dirty || invalid || disabled || saving || failed === draft) return
    const timer = setTimeout(() => { void save() }, 500)
    return () => clearTimeout(timer)
  }, [draft, dirty, invalid, disabled, saving, failed])

  const preview = async () => {
    try {
      const response = await fetch(PREVIEW_ROUTE, { method: 'POST', credentials: 'same-origin' })
      if (response.status === 409) setMessage({ kind: 'error', text: 'The AI is controlling the computer; preview is unavailable right now' })
      else if (!response.ok) setMessage({ kind: 'error', text: 'Preview failed' })
    } catch {
      setMessage({ kind: 'error', text: 'Preview failed' })
    }
  }

  if (!loaded) return h('div', { style: S.page }, 'Loading…')

  const primary = status?.displays.find(d => d.primary) ?? status?.displays[0]
  const helperOk = status?.helper === 'ready'

  return h('div', { style: S.page },
    h('style', null, selectCss),
    h('div', null,
      h('h2', { style: S.title }, 'Computer use'),
      h('p', { style: S.subtitle }, 'Let the AI see the screen, click, and type to control this Windows computer. While it does, an orange glow appears around the screen; press Esc to pause / resume, or click "Stop" on the pill to end the run.'),
    ),
    view === undefined ? h('div', { style: S.error }, 'Could not find the settings for this plugin (it may be disabled).') : null,
    view !== undefined && !writable ? h('div', { style: S.error }, 'Settings are currently read-only.') : null,

    // Status
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Status'),
      h('div', { style: S.statusLine },
        h('span', { style: { ...S.dot, background: status === null ? '#999' : helperOk ? '#2a2' : '#d33' } }),
        status === null ? 'Could not get status' : helperOk ? (status.controlling ? 'Controlling the computer' : 'Ready') : `Control helper unavailable: ${status.error ?? ''}`,
      ),
      primary ? h('p', { style: S.hint }, `Primary display ${primary.width}×${primary.height} (${Math.round(primary.dpi / 96 * 100)}% scaling); screenshots sent to the model are ${primary.shot.width}×${primary.shot.height}.`) : null,
      status && status.displays.length > 1 ? h('p', { style: S.hint }, `${status.displays.length} displays; the model can switch with switch_display.`) : null,
      h('div', { style: S.actions },
        h('button', { type: 'button', style: S.secondary, onClick: () => { void preview() } }, 'Preview'),
        h('button', { type: 'button', style: S.secondary, onClick: () => { void refreshStatus() } }, 'Refresh status'),
        h('span', { style: S.hint }, 'Previews for 4 seconds: shows the glow and the mini progress card or pill using the saved settings.'),
      ),
    ),

    // Access
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Access'),
      h('div', { style: S.label },
        'Access mode',
        h(Select, {
          label: 'Access mode', disabled, value: draft.accessMode,
          options: [{ value: 'per-app', label: 'Per app (you approve the apps each session)' }, { value: 'allow-all', label: 'Allow all apps (no approval)' }],
          onChange: (value: string) => edit('accessMode', value as Settings['accessMode']),
        }),
        h('span', { style: { ...S.hint, fontWeight: 400 } }, 'No approval is requested when the session policy is "full access" or "auto review"; per-app grants are approved automatically. Either way, the windows of DeepSeek Harness itself are never controlled.'),
      ),
      h('label', { style: S.label },
        'Blocked apps',
        h('textarea', {
          style: { ...S.input, minHeight: 72, resize: 'vertical' }, value: draft.blockedApps, disabled, spellCheck: false,
          placeholder: 'One per line: name or exe, e.g.:\nalipay\nbank helper',
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => edit('blockedApps', e.target.value),
        }),
        h('span', { style: { ...S.hint, fontWeight: 400 } }, 'Common password managers such as 1Password, Bitwarden and KeePass are always blocked.'),
      ),
    ),

    // Look
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Display while controlling'),
      h(ToggleRow, { title: 'Orange glow and status pill', hint: 'Never appears in the screenshots the model sees.', checked: draft.overlay, disabled, onChange: value => edit('overlay', value) }),
      h('div', { style: S.grid2 },
        h('label', { style: S.label },
          'Pill name',
          h('input', { style: S.input, value: draft.overlayLabel, disabled, maxLength: 40, onChange: (e: React.ChangeEvent<HTMLInputElement>) => edit('overlayLabel', e.target.value) }),
          h('span', { style: { ...S.hint, fontWeight: 400 } }, `Shown as "${draft.overlayLabel.trim() || DEFAULTS.overlayLabel} is controlling your computer"`),
        ),
        h('div', { style: S.label },
          'DeepSeek Harness window',
          h(Select, {
            label: 'DeepSeek Harness window', disabled, value: draft.hostWindow,
            options: [{ value: 'pet', label: 'Mini progress card (recommended)' }, { value: 'card', label: 'Shrink to an always-on-top card in the bottom-right corner' }, { value: 'minimize', label: 'Minimize' }, { value: 'keep', label: 'Leave unchanged' }],
            onChange: (value: string) => edit('hostWindow', value as Settings['hostWindow']),
          }),
          h('span', { style: { ...S.hint, fontWeight: 400 } }, draft.hostWindow === 'pet' ? 'DSH is minimized and a mini card appears in the bottom-right: one line scrolls the reply text, another shows thinking and tool calls; it can be dragged and has pause / stop buttons. Restored automatically when the run ends.' : 'Restores the original size and position when control ends.'),
        ),
        h('div', { style: S.label },
          'Floating card opacity',
          h(Select, {
            label: 'Floating card opacity', disabled: disabled || (draft.hostWindow !== 'card' && draft.hostWindow !== 'pet'), value: String(draft.cardOpacity),
            options: [
              { value: '100', label: 'Opaque' },
              { value: '90', label: '90%' },
              { value: '80', label: '80% (default)' },
              { value: '70', label: '70%' },
              { value: '60', label: '60%' },
              { value: '50', label: '50%: most transparent' },
            ],
            onChange: (value: string) => edit('cardOpacity', Number(value)),
          }),
          h('span', { style: { ...S.hint, fontWeight: 400 } }, 'A translucent card lets you see the work happening beneath it; hover over it to make it opaque again for easier reading and clicking. The AI screenshots never show the card anyway.'),
        ),
        h('div', { style: S.label },
          'Text input method',
          h(Select, {
            label: 'Text input method', disabled, value: draft.typingMode,
            options: [
              { value: 'stream', label: 'Stream: long text appears paragraph by paragraph (recommended)' },
              { value: 'type', label: 'Type key by key: like a person typing, slowest' },
              { value: 'paste', label: 'Paste at once: fastest' },
            ],
            onChange: (value: string) => edit('typingMode', value as Settings['typingMode']),
          }),
          h('span', { style: { ...S.hint, fontWeight: 400 } }, 'Short text is always typed key by key. Typing long text key by key can be scrambled by auto-closing brackets and auto-continuing lists in editors such as Typora, Obsidian and Word; streaming pastes paragraph by paragraph, so you can watch it happen without the mess.'),
        ),
      ),
    ),

    // Human-like input
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Human-like control'),
      h(ToggleRow, {
        title: 'Pointer glides like a hand',
        hint: 'Each move follows a slightly curved path with eased acceleration and deceleration and a little tremor, occasionally overshooting and correcting. Off means instant jumps.',
        checked: draft.naturalMouse, disabled, onChange: value => edit('naturalMouse', value),
      }),
      h('div', { style: S.grid2 },
        h(NumberField, { label: 'Pointer speed', unit: 'pixels/s', value: draft.mouseSpeed, error: errors.mouseSpeed, disabled: disabled || !draft.naturalMouse, onChange: value => edit('mouseSpeed', value) }),
        h(NumberField, { label: 'Hand tremor', unit: '%', value: draft.mouseJitter, error: errors.mouseJitter, disabled: disabled || !draft.naturalMouse, onChange: value => edit('mouseJitter', value) }),
      ),
      h(ToggleRow, {
        title: 'Wheel scrolls like a hand',
        hint: 'Starts fast and slows down, with uneven spacing between notches: more natural than a mechanical rhythm, and smooth-scrolling pages keep up.',
        checked: draft.naturalScroll, disabled, onChange: value => edit('naturalScroll', value),
      }),
      h('div', { style: S.grid2 },
        h(NumberField, { label: 'Notch interval', unit: 'ms', value: draft.scrollNotchMs, error: errors.scrollNotchMs, disabled: disabled || !draft.naturalScroll, onChange: value => edit('scrollNotchMs', value) }),
      ),
      h(ToggleRow, {
        title: 'Type like a person',
        hint: 'Each key is timed individually: letters come in runs, punctuation is slower, a few keys are mistyped and fixed with backspace, with occasional pauses. Only affects typed text (not paste).',
        checked: draft.naturalTyping, disabled, onChange: value => edit('naturalTyping', value),
      }),
      h('div', { style: S.grid2 },
        h(NumberField, { label: 'Min. key interval', unit: 'ms', value: draft.typingMinMs, error: errors.typingMinMs, disabled: disabled || !draft.naturalTyping, onChange: value => edit('typingMinMs', value) }),
        h(NumberField, { label: 'Max. key interval', unit: 'ms', value: draft.typingMaxMs, error: errors.typingMaxMs, disabled: disabled || !draft.naturalTyping, onChange: value => edit('typingMaxMs', value) }),
        h(NumberField, { label: 'Typo-and-correct rate', unit: '%', value: draft.typingErrorPct, error: errors.typingErrorPct, disabled: disabled || !draft.naturalTyping, onChange: value => edit('typingErrorPct', value) }),
      ),
    ),

    // Speed
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Speed'),
      h(ToggleRow, {
        title: 'Skip deep thinking while acting (Beta)',
        hint: 'Experimental; usually not needed. Once computer control starts, this turn uses the lowest reasoning effort, making each step about 1 second faster; planning at the start of the task and later conversation still use the reasoning effort chosen for the session. Trade-off: without thinking the model is more likely to make mistakes and take extra steps, and the reply text for this turn appears all at once instead of streaming. Currently only works with official DeepSeek models.',
        checked: draft.quickSteps, disabled, onChange: value => edit('quickSteps', value),
      }),
    ),

    // Yield to the user
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Yield control'),
      h(ToggleRow, { title: 'Pause when it detects you are using the computer', hint: 'When you type on the keyboard the AI waits for you to stop; when you switch windows it re-checks the screen first. Mouse movement does not trigger it.', checked: draft.pauseOnUserInput, disabled, onChange: value => edit('pauseOnUserInput', value) }),
      h('div', { style: S.grid2 },
        h(NumberField, { label: 'Resume after idle', unit: 'ms', value: draft.userIdleMs, error: errors.userIdleMs, disabled: disabled || !draft.pauseOnUserInput, onChange: value => edit('userIdleMs', value) }),
      ),
    ),

    // Screenshots
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Screenshots'),
      h(ToggleRow, { title: 'Send a screenshot automatically after each action', hint: 'Saves the model a round trip to take another screenshot; turn it off to save tokens.', checked: draft.autoScreenshot, disabled, onChange: value => edit('autoScreenshot', value) }),
      h('div', { style: S.grid2 },
        h(NumberField, { label: 'Minimum wait after each action (screenshot once the screen settles, up to about 2.5 s)', unit: 'ms', value: draft.settleMs, error: errors.settleMs, disabled, onChange: value => edit('settleMs', value) }),
        h(NumberField, { label: 'Screenshot longest edge', unit: 'px', value: draft.maxLongEdge, error: errors.maxLongEdge, disabled, onChange: value => edit('maxLongEdge', value) }),
        h(NumberField, { label: 'Screenshot pixel limit', unit: 'megapixels', value: draft.maxMegapixels, error: errors.maxMegapixels, disabled, onChange: value => edit('maxMegapixels', value) }),
        h(NumberField, { label: 'JPEG quality', unit: '30–100', value: draft.jpegQuality, error: errors.jpegQuality, disabled, onChange: value => edit('jpegQuality', value) }),
      ),
      h('p', { style: S.hint }, 'Larger screenshots are clearer and clicks land more precisely, but each image costs more tokens. The defaults (longest edge 1366, 1.15 megapixels) suit most models.'),
    ),

    h(SkillsCard, { S }),

    // Screenshot cache
    h('section', { style: S.card },
      h('h3', { style: S.cardTitle }, 'Screenshot cache'),
      h('p', { style: S.hint },
        cache === null ? (cacheBusy ? 'Counting…' : 'Could not count the screenshot cache.')
          : !cache.ok ? `Count failed: ${cache.error ?? ''}`
          : `This plugin has ${cache.count} screenshots using ${mb(cache.bytes)}; ${cache.orphans} (${mb(cache.orphanBytes)}) belong to deleted sessions and can be cleaned up safely.`),
      h('p', { style: S.hint }, 'Screenshots are stored as attachments in session history. Screenshots still in a session are never deleted: deleting them would make resuming that session fail. After a session is deleted, its leftover screenshots are cleaned up automatically a few minutes after DeepSeek Harness starts and then every 12 hours, or you can clean them up here now.'),
      h('div', { style: S.actions },
        h('button', {
          type: 'button', style: { ...S.secondary, opacity: cacheBusy || !cache?.orphans ? 0.5 : 1 },
          disabled: cacheBusy || !cache?.orphans, onClick: () => { void cleanCache() },
        }, 'Clean up screenshots from deleted sessions'),
        h('button', { type: 'button', style: S.secondary, disabled: cacheBusy, onClick: () => { void refreshCache() } }, cacheBusy ? 'Counting…' : 'Recount'),
        cacheNote === null ? null : h('span', { style: cacheNote.kind === 'ok' ? S.ok : S.error }, cacheNote.text),
      ),
    ),

    h('div', { style: S.actions },
      h('button', {
        type: 'button', style: S.secondary, disabled: disabled,
        onClick: () => { setDraft(draftFrom({})); setDirty(true); setMessage(null) },
      }, 'Restore defaults'),
      saving ? h('span', { style: S.hint }, 'Saving…')
        : dirty && invalid ? h('span', { style: S.error }, 'Some values are out of range; it saves automatically once fixed')
        : failed === draft && dirty ? h('button', { type: 'button', style: S.secondary, onClick: () => { setFailed(null) } }, 'Retry save')
        : null,
      message === null || (dirty && invalid) ? null : h('span', { style: message.kind === 'ok' ? S.ok : S.error }, message.text),
    ),

    h(AccentPicker, null),
  )
}

export const inject = ['slots', 'remote', 'remote.settings']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => installAccent(), 'computer-use: accent colour')
  ctx.effect(() => registerNavIcon('Computer use'), 'computer-use: settings nav icon')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: ENTRY_ID,
    order: 61,
    label: () => 'Computer use',
  }, () => h(ComputerUseSection, { ctx })))
}
