/**
 * Simple UI string translations for civic brief components.
 * Not a full i18n framework; just the labels that appear alongside
 * AI-translated content so the whole page feels consistent.
 */

export interface UIStrings {
  whatChanged: string;
  whoAffected: string;
  whatYouCanDo: string;
  whereMoneyGoes: string;
  keyDeadlines: string;
  context: string;
  verifyAt: string;
  verify: string;
  helpful: string;
  reportIssue: string;
  showVerification: string;
  hideVerification: string;
  highConfidence: string;
  mediumConfidence: string;
  lowConfidence: string;
}

const strings: Record<string, UIStrings> = {
  en: {
    whatChanged: 'What changed',
    whoAffected: 'Who is affected',
    whatYouCanDo: 'What you can do',
    whereMoneyGoes: 'Where the money goes',
    keyDeadlines: 'Key deadlines',
    context: 'Context',
    verifyAt: 'Verify at',
    verify: 'Verify',
    helpful: 'Helpful',
    reportIssue: 'Report issue',
    showVerification: 'Show verification details',
    hideVerification: 'Hide verification details',
    highConfidence: 'High confidence',
    mediumConfidence: 'Medium confidence',
    lowConfidence: 'Low confidence',
  },
  es: {
    whatChanged: 'Que cambio',
    whoAffected: 'Quien se ve afectado',
    whatYouCanDo: 'Que puedes hacer',
    whereMoneyGoes: 'A donde va el dinero',
    keyDeadlines: 'Fechas importantes',
    context: 'Contexto',
    verifyAt: 'Verificar en',
    verify: 'Verificar',
    helpful: 'Util',
    reportIssue: 'Reportar problema',
    showVerification: 'Mostrar detalles de verificacion',
    hideVerification: 'Ocultar detalles de verificacion',
    highConfidence: 'Alta confianza',
    mediumConfidence: 'Confianza media',
    lowConfidence: 'Baja confianza',
  },
  hi: {
    whatChanged: 'Kya badla',
    whoAffected: 'Kaun prabhavit hai',
    whatYouCanDo: 'Aap kya kar sakte hain',
    whereMoneyGoes: 'Paisa kahan jata hai',
    keyDeadlines: 'Mukhya samay seemayen',
    context: 'Sandarbh',
    verifyAt: 'Yahan satyapit karen',
    verify: 'Satyapit karen',
    helpful: 'Sahayak',
    reportIssue: 'Samasya ki report karen',
    showVerification: 'Satyapan vivaran dikhaye',
    hideVerification: 'Satyapan vivaran chhupaye',
    highConfidence: 'Ucch vishvas',
    mediumConfidence: 'Madhyam vishvas',
    lowConfidence: 'Kam vishvas',
  },
};

export function getUIStrings(lang: string): UIStrings {
  return strings[lang] || strings.en;
}
