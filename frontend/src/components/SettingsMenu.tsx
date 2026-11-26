import { FONTS, THEMES, type Font, type Theme } from '../lib/theme'
import { CheckIcon, PaletteIcon } from './Icons'
import { Popover } from './Popover'

interface Props {
  theme: Theme
  font: Font
  onTheme: (t: Theme) => void
  onFont: (f: Font) => void
}

export function SettingsMenu({ theme, font, onTheme, onFont }: Props) {
  return (
    <Popover label="Theme and font" icon={<PaletteIcon />} className="settings">
      {() => (
        <>
          <p className="popover-label">Theme</p>
          <div className="swatches">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`swatch ${theme === t.id ? 'is-active' : ''}`}
                onClick={() => onTheme(t.id)}
                aria-pressed={theme === t.id}
              >
                <span className={`swatch-dot swatch-${t.id}`}>{theme === t.id && <CheckIcon width={14} height={14} />}</span>
                {t.label}
              </button>
            ))}
          </div>
          <p className="popover-label">Font</p>
          <div className="segmented">
            {FONTS.map((f) => (
              <button
                key={f.id}
                className={font === f.id ? 'is-active' : ''}
                onClick={() => onFont(f.id)}
                aria-pressed={font === f.id}
                style={{ fontFamily: f.id === 'serif' ? "'Times New Roman', Times, serif" : undefined }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </Popover>
  )
}
