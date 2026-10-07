/**
 * Source Policy Engine
 *
 * Determines which sources are allowed for a given question type,
 * what content level (A/B/C/D) applies, and when the system must
 * abstain. This is a programmatic layer, not just a prompt instruction.
 */

export type QuestionType =
  | 'ayah'
  | 'hadith'
  | 'tafsir'
  | 'fiqh'
  | 'aqeedah'
  | 'term'
  | 'fatwa'
  | 'biography'
  | 'history'
  | 'general'
  | 'methodology'

export type ContentLevel = 'A' | 'B' | 'C' | 'D'

export interface PolicyDecision {
  questionType: QuestionType
  contentLevel: ContentLevel
  allowedSourceTypes: string[]
  allowDirectAnswer: boolean
  mustShowDiff: boolean
  mustShowGrade: boolean
  abstainIfNoSource: boolean
  policyNotes: string
  isPersonalFatwa: boolean
}

const DEFAULT_POLICIES: Record<QuestionType, PolicyDecision> = {
  ayah: {
    questionType: 'ayah',
    contentLevel: 'A',
    allowedSourceTypes: ['quran', 'tafsir'],
    allowDirectAnswer: true,
    mustShowDiff: true,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'القرآن الكريم يجب أن يأتي من المصدر المعتمد فقط. لا يجوز للنموذج إعادة كتابة الآية من ذاكرته. افصل النص القرآني عن الشرح وعن تحليل النظام. إذا كتب المستخدم آية فيها خطأ، اعرض النص الصحيح مع تنبيه محترم.',
    isPersonalFatwa: false,
  },
  hadith: {
    questionType: 'hadith',
    contentLevel: 'B',
    allowedSourceTypes: ['hadith'],
    allowDirectAnswer: true,
    mustShowDiff: true,
    mustShowGrade: true,
    abstainIfNoSource: true,
    policyNotes:
      'لا يُسمح للنظام بإنشاء حديث. إذا لم يجد حديثًا مطابقًا في المصادر المتاحة يقول: "لم أعثر على حديث مطابق في المصادر المتاحة، ولا يمكنني إنشاء نسبة غير موثقة." يجب إظهار درجة الحديث ومصدره عند التواجد، والفصل بين كلام النبي ﷺ وكلام الشارح.',
    isPersonalFatwa: false,
  },
  tafsir: {
    questionType: 'tafsir',
    contentLevel: 'B',
    allowedSourceTypes: ['tafsir', 'quran'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'يسمح بمصادر التفسير المحددة. يجب إسناد كل قول في التفسير إلى المؤلف والصفحة. لا يخلط النظام بين آراء المفسرين دون إسناد.',
    isPersonalFatwa: false,
  },
  fiqh: {
    questionType: 'fiqh',
    contentLevel: 'C',
    allowedSourceTypes: ['fiqh'],
    allowDirectAnswer: false,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'في مسائل الخلاف الفقهي يجب بيان الخلاف وعدم القطع برأي واحد دون أساس. لا يقدم النظام فتوى شخصية مستقلة، ويُحيل المسائل الشخصية إلى مختص.',
    isPersonalFatwa: false,
  },
  aqeedah: {
    questionType: 'aqeedah',
    contentLevel: 'C',
    allowedSourceTypes: ['aqeedah', 'tafsir', 'hadith'],
    allowDirectAnswer: false,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'مسائل العقيدة حساسة. يجب بيان الخلاف أو تقييد الإجابة بالمصادر. لا يجوز عرض الاستنتاج على أنه نص المؤلف.',
    isPersonalFatwa: false,
  },
  term: {
    questionType: 'term',
    contentLevel: 'B',
    allowedSourceTypes: ['language'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'لا يجعل الـLLM يختلق تعريفًا. اعرض المعنى من المعجم المعتمد مع اسم المعجم والموضع. إذا استخدمت شرحًا مبسطًا، اكتب: "شرح مبسط اعتمادًا على المصدر".',
    isPersonalFatwa: false,
  },
  fatwa: {
    questionType: 'fatwa',
    contentLevel: 'D',
    allowedSourceTypes: [],
    allowDirectAnswer: false,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'هذا السؤال يتعلق بحالة شخصية، ولا يقدم النظام فتوى مستقلة. يقدم معلومات عامة فقط ويحيل المستخدم إلى جهة مؤهلة.',
    isPersonalFatwa: true,
  },
  biography: {
    questionType: 'biography',
    contentLevel: 'A',
    allowedSourceTypes: ['history', 'general'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes: 'معلومات تراجم: إسناد كل معلومة إلى مصدرها التاريخي.',
    isPersonalFatwa: false,
  },
  history: {
    questionType: 'history',
    contentLevel: 'A',
    allowedSourceTypes: ['history', 'general'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes: 'إسناد كل معلومة تاريخية إلى مصدرها.',
    isPersonalFatwa: false,
  },
  methodology: {
    questionType: 'methodology',
    contentLevel: 'B',
    allowedSourceTypes: ['tafsir', 'hadith', 'fiqh', 'aqeedah', 'general'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'تحليل منهج المؤلف يجب أن يكون مبنيًا على مقاطع مسترجعة فقط. كل استنتاج يجب أن يرتبط بأدلة وصفحات. لا يجوز عرض الاستنتاج على أنه كلام المؤلف.',
    isPersonalFatwa: false,
  },
  general: {
    questionType: 'general',
    contentLevel: 'B',
    allowedSourceTypes: ['tafsir', 'hadith', 'fiqh', 'aqeedah', 'language', 'history', 'general', 'quran'],
    allowDirectAnswer: true,
    mustShowDiff: false,
    mustShowGrade: false,
    abstainIfNoSource: true,
    policyNotes:
      'سؤال عام: استخدم أي مصدر متاح مع إسناد كل معلومة. إذا لم توجد أدلة كافية، اصرّح بعدم كفاية المصادر.',
    isPersonalFatwa: false,
  },
}

// Classify the question by inspecting keywords/patterns (Arabic-aware)
export function classifyQuestion(question: string): QuestionType {
  const q = (question || '').trim()
  const ql = q.toLowerCase()
  const low = q

  // Personal fatwa signals
  if (
    /(أنا|انا|زوجتي|زوجي|ابني|ابنتي|أبي|أمي|امي|حالتي|وضعي|عملي|تجارتي|ماذا أفعل|ماذا أقول|هل عليّ|هل علي|هل يجوز لي|هل يجوز لى|حكم .*(خاص|خاصتي|حالتي))/i.test(
      low
    )
  ) {
    if (/(يجوز|حكم|حرام|حلال|طلاق|طلاق|زواج|معاملة|ربا|بيع|شراء|إثم|ذنب|كفارة|قضاء)/i.test(low)) {
      return 'fatwa'
    }
  }

  // Ayah detection
  if (
    /(آية|اية)\s*(كريمة)?|القرآن|القران|سورة|السورة|جزء \d|الجزء \d|\[\[.*?\d+:\d+.*?\]\]/i.test(low)
  ) {
    return 'ayah'
  }

  // Hadith detection
  if (
    /(حديث|روى|رواه|أخرجه|اخرج|في سنن|في صحيح|مسند|مرفوع|موقوف|مقطوع|سند|إسناد|أسانيد|درجة الحديث|صحيح|حسن|ضعيف|موضوع|النبي ﷺ|رسول الله|قال رسول)/i.test(
      low
    )
  ) {
    return 'hadith'
  }

  // Tafsir
  if (/(تفسير|معنى الآية|المعنى|القراءة|القراءات|أسباب النزول|سبب النزول|ناسخ ومنسوخ|متشابه|محكم)/i.test(low)) {
    return 'tafsir'
  }

  // Fiqh
  if (
    /(فقه|مذهب|حكم|يجوز|لا يجوز|حرام|حلال|واجب|مستحب|مكروه|فرض|سنة|نفل|عبادة|طهارة|صلاة|صوم|زكاة|حج|معاملة|بيع|ربا|نكاح|طلاق|جناية|حد)/i.test(
      low
    )
  ) {
    return 'fiqh'
  }

  // Aqeedah
  if (
    /(عقيدة|توحيد|صفات الله|أسماء الله|إيمان|ايمان|كفر|شرك|بدعة|سنة(?!.*الفعل)|عقائد|الغيب|اليوم الآخر|القدر|الإلهية|الربوبية)/i.test(
      low
    )
  ) {
    return 'aqeedah'
  }

  // Term / language
  if (
    /(معنى كلمة|تعريف|ما معنى|معنى مصطلح|ما هو.*مصطلح|مصطلح|غريب|لغة|لغوي|اشتقاق|جذر|جمع|مفرد|المعجم|القاموس|مادة)/i.test(
      low
    )
  ) {
    return 'term'
  }

  // Biography
  if (/(ترجمة|تراجم|سيرة|حياة|من هو|من هي|ولد|توفي|وفاته|مولده|نشأته|شيوخه|تلاميذه)/i.test(low)) {
    return 'biography'
  }

  // Methodology
  if (
    /(منهج|منهج المؤلف|منهج الكتاب|طريقة|أسلوب|موسوعة|مدرسة|أثر|تأثر|الإسرائيليات|اسرائيليات|القراءات|طريقة الاستدلال|منهج الاستدلال|مصادر المؤلف)/i.test(
      low
    )
  ) {
    return 'methodology'
  }

  // History
  if (/(تاريخ|حدث|وقعة|معركة|خلافة|عصر|عهد|سنة \d|قرن \d|الفتح|الدولة|الإسلامي)/i.test(low)) {
    return 'history'
  }

  return 'general'
}

export function getPolicy(questionType: QuestionType): PolicyDecision {
  return DEFAULT_POLICIES[questionType] || DEFAULT_POLICIES.general
}

// Filter the available sources by the policy (returns allowed ones)
export function filterSourcesByPolicy(
  sources: Array<{ id: string; sourceType: string; isOfficial?: boolean }>,
  policy: PolicyDecision
): Array<{ id: string; sourceType: string; isOfficial?: boolean }> {
  // For personal fatwa, we don't allow direct answers at all
  if (policy.isPersonalFatwa) return sources // we will still retrieve context but not answer
  return sources.filter((s) => policy.allowedSourceTypes.includes(s.sourceType))
}
