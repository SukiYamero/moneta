# Design export reference — the Add sheet and the tag picker

**Why this file exists.** `specs.md` §10.23 was written on 2026-08-20 from
prose, before the design export was versioned. Its "UI" section describes a
labelled vertical form. The export's actual Add-sheet artboard describes
something materially different, and **nobody had ever read it**. The Wave 4.1
extraction (`design-export-reference.md`) does not cover it, because that
extraction was deliberately scoped to the four areas Wave 4.1 needed.

The gap was found on 2026-08-24 by the user, from the running app, not by any
review pass. See "What this means for the process" at the bottom.

**Source, so this is auditable:** `docs/ui/Moneta_ Expense Manager UI.zip`
→ `export/Moneta-standalone.html`. The markup below is that file's own,
unescaped verbatim (the export stores the DOM as a JSON-escaped string; the
`/`/`\n`/`\"` sequences were reversed, nothing else). The Add sheet sits
between the `AUTH: DRIVE PERMISSION` and `ESCANEO DE FACTURA` artboard
markers, introduced by its own `<!-- add sheet -->` comment rather than the
`<!-- ===== NAME ===== -->` banner every other artboard uses — **which is
why a marker-based search missed it.**

Same snapshot caveat as `design-export-reference.md`: this is a point-in-time
export, not the live canvas (unreachable to an agent session, 403, verified).
`specs.md` outranks it on behavior.

---

## 1. What the artboard actually specifies

Read against what `MovimientoFormFields.tsx` renders today:

| Element     | The export                                                                                                                                        | On `main` (2026-08-24)                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Header      | grabber + a **gear button** (right, 34px, opens settings). **No title.**                                                                          | title "Add movement", no gear                                |
| Type toggle | `Gasto`/`Ingreso`, 4px-padded track, 16px radius, 13px inner radius                                                                               | `SegmentedControl` — close enough, verify the metrics        |
| Date        | **centered chip above the amount**, always visible, expanding an inline month calendar in place                                                   | below the amount, left-aligned under a "Date" label          |
| Amount      | centered "Monto" label, currency symbol + **borderless auto-sizing input**, 46px/800, `field-sizing:content`, `inputmode="decimal"`               | `AmountField` — a bordered, labelled field                   |
| Categories  | fixed left column (a **count button** opening the tag picker + a **dashed "Custom"** chip) beside a **2-row horizontal carousel** of tinted chips | `CategoryPicker` with an inline search box and wrapped chips |
| Note        | "Descripción", `maxlength=40`, **hidden behind a "Ver más" disclosure**                                                                           | always visible, labelled "Note"                              |
| Actions     | camera 54px + primary + mic 54px                                                                                                                  | Cancel / Save                                                |

### Decisions already taken against this artboard

- **The camera and microphone are not rendered** (user, 2026-08-24), keeping
  §10.23 Decision 5: scan is deferred indefinitely, voice does not exist, and
  a control that looks live and is not is worse than its absence. The primary
  action takes the full row width. The seam for voice stays
  `useMovimientoForm.applyParsedFields`, per that same decision.
- **Edit mode inherits the same layout** (user, 2026-08-24) — §10.23
  Decision 1's one-form rule is exactly what would break otherwise.

---

## 2. The Add sheet, verbatim

```html
<!-- add sheet -->
<sc-if value="{{ sheetOpen }}" hint-placeholder-val="{{ false }}">
  <div
    sc-camel-on-click="{{ closeSheet }}"
    style="position:absolute; inset:0; background:rgba(0,0,0,.55); animation:mnFade .2s ease; z-index:20;"
  ></div>
  <div
    class="mn-scroll"
    style="position:absolute; left:0; right:0; bottom:0; max-height:94%; overflow-y:auto; background:var(--mn-surface); border-radius:30px 30px 44px 44px; padding:12px 24px 34px; z-index:21; animation:mnSheetUp .32s cubic-bezier(.32,.72,0,1); border-top:1px solid var(--mn-f6);"
  >
    <div style="position:relative; height:22px; margin-bottom:10px;">
      <div
        style="width:38px; height:5px; border-radius:3px; background:var(--mn-line2); margin:6px auto 0;"
      ></div>
      <button
        sc-camel-on-click="{{ openSettings }}"
        style="position:absolute; right:0; top:-2px; width:34px; height:34px; border:none; border-radius:12px; background:var(--mn-f5); color:var(--mn-text3); font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer;"
        style-hover="background:var(--mn-f1);"
      >
        <i class="ph ph-gear-six"></i>
      </button>
    </div>

    <!-- type toggle -->
    <div
      style="display:flex; background:var(--mn-bg); border-radius:16px; padding:4px; margin-bottom:20px;"
    >
      <button
        sc-camel-on-click="{{ setExpense }}"
        style="flex:1; padding:11px; border:none; border-radius:13px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; background:{{ expBtnBg }}; color:{{ expBtnColor }};"
      >
        Gasto
      </button>
      <button
        sc-camel-on-click="{{ setIncome }}"
        style="flex:1; padding:11px; border:none; border-radius:13px; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; background:{{ incBtnBg }}; color:{{ incBtnColor }};"
      >
        Ingreso
      </button>
    </div>

    <!-- fecha (siempre visible) -->
    <div style="display:flex; justify-content:center; margin-bottom:18px;">
      <button
        sc-camel-on-click="{{ toggleNewCal }}"
        style="display:flex; align-items:center; gap:7px; height:34px; padding:0 13px; border:1px solid {{ newCalBorder }}; border-radius:12px; background:var(--mn-bg); color:var(--mn-text2); font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer;"
        style-hover="border-color:var(--mn-f16);"
      >
        <i class="ph ph-calendar-blank" style="font-size:15px; color:var(--mn-muted2);"></i>
        {{ newDateLabel }}
        <i
          class="ph-bold ph-caret-down"
          style="font-size:10px; color:var(--mn-muted2); transform:{{ newCalCaret }}; transition:transform .2s;"
        ></i>
      </button>
    </div>

    <sc-if value="{{ newCalOpen }}" hint-placeholder-val="{{ false }}">
      <div
        style="background:var(--mn-bg); border:1px solid var(--mn-f6); border-radius:16px; padding:13px; margin-bottom:12px;"
      >
        <div
          style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;"
        >
          <button
            sc-camel-on-click="{{ newCalPrev }}"
            style="width:28px; height:28px; border:none; border-radius:9px; background:var(--mn-f5); color:var(--mn-text2); font-size:13px; cursor:pointer;"
          >
            <i class="ph-bold ph-caret-left"></i>
          </button>
          <span style="font-size:13.5px; font-weight:700;">{{ newCalLabel }}</span>
          <button
            sc-camel-on-click="{{ newCalNext }}"
            style="width:28px; height:28px; border:none; border-radius:9px; background:var(--mn-f5); color:var(--mn-text2); font-size:13px; cursor:pointer;"
          >
            <i class="ph-bold ph-caret-right"></i>
          </button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px; margin-bottom:5px;">
          <sc-for list="{{ calDowNames }}" as="n" hint-placeholder-count="7">
            <div
              style="text-align:center; font-size:10px; font-weight:700; color:var(--mn-muted3);"
            >
              {{ n.label }}
            </div>
          </sc-for>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:3px;">
          <sc-for list="{{ newCalCells }}" as="c" hint-placeholder-count="35">
            <button
              sc-camel-on-click="{{ c.onTap }}"
              style="aspect-ratio:1; border:none; border-radius:{{ c.radius }}; background:{{ c.bg }}; color:{{ c.color }}; font-family:inherit; font-size:12.5px; font-weight:{{ c.weight }}; cursor:{{ c.cursor }}; padding:0; display:flex; align-items:center; justify-content:center;"
            >
              {{ c.label }}
            </button>
          </sc-for>
        </div>
      </div>
    </sc-if>

    <!-- monto (teclado nativo) -->
    <div style="margin:0 0 26px;">
      <div
        style="font-size:12.5px; color:var(--mn-muted); font-weight:600; margin-bottom:8px; text-align:center;"
      >
        Monto
      </div>
      <div
        style="display:flex; align-items:center; justify-content:center; gap:8px; padding:6px 4px;"
      >
        <span style="font-size:27px; font-weight:800; color:var(--mn-muted3); flex:0 0 auto;"
          >{{ currencySymbol }}</span
        >
        <input
          value="{{ amount }}"
          sc-camel-on-change="{{ setAmountInput }}"
          inputmode="decimal"
          placeholder="0"
          style="width:{{ amountWidth }}; field-sizing:content; min-width:48px; max-width:calc(100% - 48px); background:transparent; border:none; outline:none; text-align:center; color:{{ amountColor }}; font-family:inherit; font-size:46px; font-weight:800; letter-spacing:-1.2px; padding:0;"
        />
      </div>
    </div>

    <!-- fecha movida a “Ver más” -->

    <!-- etiquetas: columna fija (ver todas + custom) + carrusel de 2 filas -->
    <div style="display:flex; gap:8px; margin-bottom:6px;">
      <div
        style="flex:0 0 auto; display:grid; grid-template-rows:repeat(2,auto); gap:7px; padding:2px 0;"
      >
        <button
          sc-camel-on-click="{{ openTagPicker }}"
          style="display:flex; align-items:center; gap:5px; padding:7px 11px; border-radius:12px; border:none; background:var(--mn-surface3); color:var(--mn-text2); font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer;"
          style-hover="background:var(--mn-surface5);"
        >
          <i class="ph ph-list-magnifying-glass" style="font-size:14px;"></i>
          {{ tagCount }}
        </button>
        <button
          sc-camel-on-click="{{ openCustom }}"
          style="display:flex; align-items:center; gap:5px; padding:7px 11px; border-radius:12px; border:1px dashed var(--mn-f2); background:transparent; color:var(--mn-text3); font-family:inherit; font-size:11.5px; font-weight:600; cursor:pointer;"
          style-hover="border-color:rgba(47,216,150,.5); color:var(--mn-text);"
        >
          <i class="ph ph-plus" style="font-size:14px;"></i>
          Custom
        </button>
      </div>
      <div
        style="flex:1; min-width:0; display:grid; grid-auto-flow:column; grid-template-rows:repeat(2,auto); grid-auto-columns:max-content; gap:7px; overflow-x:auto; padding:2px 0;"
        class="mn-scroll"
      >
        <sc-for list="{{ categories }}" as="c" hint-placeholder-count="8">
          <button
            sc-camel-on-click="{{ c.onSelect }}"
            style="display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:12px; border:1px solid {{ c.border }}; background:{{ c.bg }}; color:{{ c.textColor }}; font-family:inherit; font-size:11.5px; font-weight:600; cursor:pointer; white-space:nowrap;"
          >
            <i class="{{ c.icon }}" style="font-size:14px; color:{{ c.iconColor }};"></i>
            {{ c.name }}
          </button>
        </sc-for>
      </div>
    </div>

    <!-- ver más -->
    <div style="display:flex; justify-content:center; margin:20px 0 6px;">
      <button
        sc-camel-on-click="{{ toggleMore }}"
        style="display:flex; align-items:center; gap:6px; padding:8px 14px; border:none; background:transparent; color:var(--mn-muted); font-family:inherit; font-size:13px; font-weight:700; cursor:pointer;"
        style-hover="color:var(--mn-text);"
      >
        {{ moreLabel }}
        <i
          class="ph-bold ph-caret-down"
          style="font-size:11px; transform:{{ moreCaret }}; transition:transform .2s;"
        ></i>
      </button>
    </div>

    <sc-if value="{{ moreOpen }}" hint-placeholder-val="{{ false }}">
      <div style="margin-bottom:4px;">
        <div
          style="font-size:11.5px; font-weight:700; color:var(--mn-muted2); letter-spacing:.5px; text-transform:uppercase; margin-bottom:7px;"
        >
          Descripción
        </div>
        <input
          value="{{ desc }}"
          sc-camel-on-change="{{ setDesc }}"
          maxlength="40"
          placeholder="Opcional"
          style="width:100%; height:44px; border:1px solid var(--mn-f8); border-radius:14px; background:var(--mn-bg); color:var(--mn-text); font-family:inherit; font-size:14px; font-weight:600; padding:0 13px; outline:none;"
        />
      </div>
    </sc-if>

    <div style="display:flex; gap:9px; margin-top:34px;">
      <button
        sc-camel-on-click="{{ startScan }}"
        title="Escanear factura"
        style="width:54px; height:54px; flex:0 0 auto; border:1px solid var(--mn-f8); border-radius:18px; background:var(--mn-f4); color:var(--mn-text2); font-size:22px; display:flex; align-items:center; justify-content:center; cursor:pointer;"
        style-hover="background:var(--mn-f9);"
      >
        <i class="ph ph-camera"></i>
      </button>
      <button
        sc-camel-on-click="{{ addTx }}"
        style="flex:1; height:54px; border:none; border-radius:18px; background:{{ addBg }}; color:{{ addColor }}; font-family:inherit; font-size:15.5px; font-weight:800; cursor:{{ addCursor }};"
      >
        {{ addLabel }}
      </button>
      <button
        sc-camel-on-click="{{ startVoice }}"
        title="Dictar"
        style="width:54px; height:54px; flex:0 0 auto; border:none; border-radius:18px; background:var(--mn-accent); color:var(--mn-on-accent); font-size:23px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 6px 18px rgba(47,216,150,.28);"
      >
        <i class="ph-fill ph-microphone"></i>
      </button>
    </div>
  </div>
</sc-if>
```

---

## 3. The tag picker the count button opens, verbatim

This is where the export puts the **search box** that today lives inline in
the sheet, plus the "Crear «query»" affordance §10.22 already specifies.

```html
<!-- ===== TAG PICKER (todas las etiquetas, buscable) ===== -->
<sc-if value="{{ tagPickerOpen }}" hint-placeholder-val="{{ false }}">
  <div
    sc-camel-on-click="{{ closeTagPicker }}"
    style="position:absolute; inset:0; background:rgba(0,0,0,.6); animation:mnFade .18s ease; z-index:30;"
  ></div>
  <div
    class="mn-scroll"
    style="position:absolute; left:0; right:0; bottom:0; max-height:82%; overflow-y:auto; background:var(--mn-surface); border-radius:30px 30px 44px 44px; padding:10px 22px 28px; z-index:31; animation:mnSheetUp .3s cubic-bezier(.32,.72,0,1); border-top:1px solid var(--mn-f6);"
  >
    <div
      style="width:38px; height:5px; border-radius:3px; background:var(--mn-line2); margin:0 auto 16px;"
    ></div>
    <div
      style="display:flex; align-items:center; gap:10px; background:var(--mn-bg); border:1px solid var(--mn-f7); border-radius:14px; padding:0 13px; height:46px; margin-bottom:14px;"
    >
      <i class="ph ph-magnifying-glass" style="font-size:17px; color:var(--mn-muted2);"></i>
      <input
        value="{{ tagQuery }}"
        sc-camel-on-change="{{ setTagQuery }}"
        placeholder="Buscar etiqueta"
        style="flex:1; min-width:0; background:transparent; border:none; outline:none; color:var(--mn-text); font-family:inherit; font-size:14.5px; font-weight:600;"
      />
    </div>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:14px;">
      <sc-for list="{{ pickerTags }}" as="t" hint-placeholder-count="8">
        <button
          sc-camel-on-click="{{ t.onSelect }}"
          style="display:flex; align-items:center; gap:9px; padding:11px 12px; border:1px solid {{ t.border }}; border-radius:14px; background:{{ t.bg }}; color:{{ t.textColor }}; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; text-align:left;"
        >
          <span
            style="width:30px; height:30px; flex:0 0 auto; border-radius:10px; background:{{ t.tint }}; color:{{ t.iconColor }}; font-size:15px; display:flex; align-items:center; justify-content:center;"
            ><i class="{{ t.icon }}"></i
          ></span>
          <span
            style="flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
            >{{ t.name }}</span
          >
        </button>
      </sc-for>
    </div>
    <sc-if value="{{ pickerEmpty }}" hint-placeholder-val="{{ false }}">
      <button
        sc-camel-on-click="{{ createFromQuery }}"
        style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:15px; border:1px dashed rgba(47,216,150,.4); border-radius:15px; background:rgba(47,216,150,.08); color:var(--mn-accent-2); font-family:inherit; font-size:14px; font-weight:700; cursor:pointer;"
      >
        <i class="ph-bold ph-plus"></i> Crear “{{ tagQuery }}”
      </button>
    </sc-if>
  </div>
</sc-if>
```

---

## 4. Reading the export's raw values — do not copy them

The markup is untokenized inline CSS with Phosphor icons, which is what a
canvas export is. `AGENTS.md` and `docs/ui/design-tokens.md` already settle
all of it: Lucide not Phosphor, tokens not hex, `rem` not px, ≥44px targets
(the export's 34px gear and its 30px tag tiles are **below the floor** — grow
the hit area without growing the visible box, the pattern `HomeHeader.tsx`
already uses for the bell). `--ease-ios` and `--animate-sheet-up` already
match the export's `cubic-bezier(.32,.72,0,1)` / `mnSheetUp .32s` exactly.

The one value worth lifting as-is is `field-sizing: content` on the amount
input — a real platform API, well supported, and the only reasonable way to
get an auto-width centered numeric display without measuring text in JS.

## 5. What this means for the process

`design-export-reference.md` was scoped to four areas and said so honestly.
Nothing was hidden. But the consequence went unnoticed for four days: a
spec section written from prose stayed authoritative over a design artboard
nobody had compared it to, the code implemented that spec faithfully, and
**every review pass since agreed with it** — because a reviewer scoped to a
track checks the code against the spec, and the spec was the thing that was
wrong.

Filed as a finding, not a chore: **when a design export is versioned, the
artboards it contains must be diffed against the spec sections that claim to
describe them**, or the export is decoration. The remaining unextracted
artboards (`GROUPS LIST`, `GROUP SCREEN`, `GROUP EDITOR`, `SETTINGS SCREEN`,
`VOICE`, `ESCANEO`, `DICTADO EN EDICIÓN`, `SKELETON`, `TOAST`, `SYNC
INDICATOR`, `INFO TOOLTIP`, `DELETE CONFIRM`, `SIGN-OUT CONFIRM`,
`FILTER SHEET`, `MOVEMENT SHEET`, `SEARCH SCREEN`, `PROFILE SHEET`,
`CUSTOM TAG MODAL`, `AUTH: WELCOME`) appear nowhere in the versioned
extraction. That is not proof they diverge — it is proof nobody has checked,
which is the same position the Add sheet was in this morning.
