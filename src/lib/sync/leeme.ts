import { APP_NAME } from '@/lib/branding'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { leemeFilename, OP_FORMAT_VERSION } from '@/lib/sync/opLog'

// leeme.ts — the plain-language file bootstrap.ts writes into the Drive
// folder (specs.md §10.19): "the data is the user's" is only true if a
// person can use it the day the app stops existing. Deliberately its own
// module, not the shared i18n JSON tables — this is prose written for a
// Drive folder, not a UI string looked up by react-i18next, and those files
// are key-parity-enforced and owned by a parallel track this wave (G1).
//
// Content order is fixed by the spec, not stylistic: what these files are →
// the CSV is the easy path → the JSON is the complete record → the one
// sentence that turns JSON into a table → nothing here is locked. No jargon,
// no field-by-field schema dump — a person who has never opened a JSON file
// should finish it knowing what to do.

export { leemeFilename }

const LEEME_CONTENT: Record<SupportedLocale, (appName: string) => string> = {
  es: (appName) => `Esto es tu carpeta de ${appName} — estos archivos son tuyos.

Guardamos acá todo lo que registraste en ${appName}: tus movimientos y tus
activos, tal como los fuiste anotando desde cualquiera de tus dispositivos.

EL CAMINO FÁCIL: los archivos .csv
Los archivos que terminan en .csv (por ejemplo "movimientos-2026.csv") se
abren con un doble clic en Excel o en Google Sheets, como cualquier planilla.
Hay uno por cada año ya cerrado. El año en curso todavía no tiene su .csv —
se genera recién cuando el año termina.

LOS ARCHIVOS .json: el registro completo
Los archivos que terminan en .json (por ejemplo "mov-xxxx-2026-08.json") son
el registro completo, incluidas las correcciones que hiciste con el tiempo.
Un mismo movimiento puede aparecer más de una vez ahí — cada corrección queda
anotada, no se borra la anterior — y los que borraste quedan marcados como
tales en vez de desaparecer del archivo.

Si alguna vez necesitás convertir un .json en una tabla vos mismo (o pedirle
a alguien que te ayude, como un asistente o un amigo), la regla es una sola
frase: quedate con la entrada más reciente de cada "id", y descartá las que
digan "del".

Nada de esto está cifrado ni bloqueado: es tuyo para abrir, copiar o llevarte
a donde quieras, cuando quieras.

(Versión del formato: ${OP_FORMAT_VERSION})
`,
  en: (appName) => `This is your ${appName} folder — these files are yours.

Everything you recorded in ${appName} lives here: your movements and your
assets, exactly as you entered them from any of your devices.

THE EASY PATH: the .csv files
Files ending in .csv (for example "movimientos-2026.csv") open with a
double-click in Excel or Google Sheets, like any spreadsheet. There is one
per closed year. The current year doesn't have a .csv yet — it's generated
once the year ends.

THE .json FILES: the complete record
Files ending in .json (for example "mov-xxxx-2026-08.json") are the complete
record, including every correction you made over time. The same entry can
show up more than once — every correction is kept, the earlier version isn't
erased — and anything you deleted stays marked as deleted instead of
disappearing from the file.

If you ever need to turn a .json file into a table yourself (or hand it to
someone who can, like an assistant or a friend), the rule fits in one
sentence: keep the most recent entry for each "id", and drop the ones marked
"del".

None of this is encrypted or locked: it's yours to open, copy, or take
somewhere else, whenever you want.

(Format version: ${OP_FORMAT_VERSION})
`,
  'es-AR': (appName) => `Esta es tu carpeta de ${appName} — estos archivos son tuyos.

Acá guardamos todo lo que registraste en ${appName}: tus movimientos y tus
activos, tal cual los fuiste anotando desde cualquiera de tus dispositivos.

EL CAMINO FÁCIL: los archivos .csv
Los archivos que terminan en .csv (por ejemplo "movimientos-2026.csv") se
abren con un doble clic en Excel o en Google Sheets, como cualquier planilla.
Hay uno por cada año ya cerrado. El año en curso todavía no tiene su .csv —
se genera recién cuando el año termina.

LOS ARCHIVOS .json: el registro completo
Los archivos que terminan en .json (por ejemplo "mov-xxxx-2026-08.json") son
el registro completo, incluidas las correcciones que hiciste con el tiempo.
Un mismo movimiento puede aparecer más de una vez ahí — cada corrección queda
anotada, no se borra la anterior — y los que borraste quedan marcados como
tales en vez de desaparecer del archivo.

Si alguna vez necesitás convertir un .json en una tabla vos mismo (o pedirle
a alguien que te ayude, como un asistente o un amigo), la regla es una sola
frase: quedate con la entrada más reciente de cada "id", y descartá las que
digan "del".

Nada de esto está cifrado ni bloqueado: es tuyo para abrir, copiar o llevarte
a donde quieras, cuando quieras.

(Versión del formato: ${OP_FORMAT_VERSION})
`,
  'pt-BR': (appName) => `Esta é a sua pasta do ${appName} — estes arquivos são seus.

Guardamos aqui tudo o que você registrou no ${appName}: seus movimentos e
seus ativos, exatamente como você anotou em qualquer um dos seus aparelhos.

O CAMINHO FÁCIL: os arquivos .csv
Os arquivos que terminam em .csv (por exemplo "movimientos-2026.csv") abrem
com um duplo clique no Excel ou no Google Sheets, como qualquer planilha. Há
um para cada ano já encerrado. O ano atual ainda não tem seu .csv — ele é
gerado só quando o ano termina.

OS ARQUIVOS .json: o registro completo
Os arquivos que terminam em .json (por exemplo "mov-xxxx-2026-08.json") são
o registro completo, incluindo cada correção que você fez ao longo do tempo.
O mesmo lançamento pode aparecer mais de uma vez ali — cada correção fica
registrada, a anterior não é apagada — e o que você excluiu continua
marcado como excluído em vez de desaparecer do arquivo.

Se um dia precisar transformar um .json numa tabela você mesmo (ou pedir
ajuda a alguém, como um assistente ou um amigo), a regra cabe numa frase só:
fique com a entrada mais recente de cada "id", e descarte as marcadas "del".

Nada disso está criptografado ou bloqueado: é seu para abrir, copiar ou
levar para outro lugar, quando quiser.

(Versão do formato: ${OP_FORMAT_VERSION})
`,
}

/** `bootstrap.ts` writes this into the KuroBello folder; the sync engine rewrites it whenever `OP_FORMAT_VERSION` changes, never leaving it describing an older shape. */
export const buildLeemeContent = (locale: SupportedLocale, appName: string = APP_NAME): string =>
  LEEME_CONTENT[locale](appName)
