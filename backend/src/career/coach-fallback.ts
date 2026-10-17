// Available even when the Python service or its model provider is offline.
// This is explicitly labelled guided practice, never an AI evaluation.
export function guidedCoach(input: Record<string, unknown>): Record<string, unknown> {
  const job = (input.job || {}) as { title?: string; skills?: { name: string }[]; description?: string };
  const skills = (job.skills || []).map(s => s.name).filter(Boolean).slice(0, 3);
  const fr = input.locale === 'fr', ar = input.locale === 'ar';
  const title = job.title || (fr ? 'ce poste' : ar ? 'هذا المنصب' : 'this role');
  const pick = (f: string, e: string, a: string) => fr ? f : ar ? a : e;
  if (input.action === 'questions') {
    if (input.interviewType === 'CODING') {
      const mobile = skills.some(s => /react|javascript|typescript/i.test(s));
      return { method: 'guided_practice', questions: [
        mobile ? pick('Implémente un composant de liste filtrable : affiche les éléments reçus, ajoute un champ de recherche et gère la liste vide. Explique ton raisonnement et ajoute un test.', 'Implement a filterable list component: render supplied items, add a search field and handle an empty list. Explain your reasoning and add a test.', 'نفذ مكون قائمة قابلة للتصفية مع بحث وحالة القائمة الفارغة. اشرح تفكيرك وأضف اختباراً.') : pick('Implémente une fonction qui regroupe une liste de transactions par catégorie et calcule chaque total. Définis les entrées et sorties et ajoute des tests, dont une liste vide.', 'Implement a function that groups transactions by category and computes each total. Define inputs and outputs and add tests, including an empty list.', 'نفذ دالة تجمع المعاملات حسب الفئة وتحسب الإجماليات. حدد المدخلات والمخرجات وأضف اختبارات بما فيها قائمة فارغة.'),
        pick('Modifie ta solution pour gérer les entrées invalides sans interrompre le traitement des données valides. Écris le code et les tests correspondants.', 'Modify your solution to handle invalid inputs without interrupting valid data processing. Write the code and corresponding tests.', 'عدل حلك للتعامل مع المدخلات غير الصالحة دون تعطيل البيانات الصالحة. اكتب الكود والاختبارات.'),
      ] };
    }
    const cv = String((input.candidate as { text?: string } | undefined)?.text ?? '');
    const evidence = cv.split(/\r?\n/).filter(line => line.length > 35 && line.length < 300 && skills.some(s => line.toLowerCase().includes(s.toLowerCase()))).slice(0, 2);
    const specific = ['TECHNICAL', 'CODING'].includes(String(input.interviewType)) && skills.length
      ? skills.map(s => pick(`Pour ${title}, explique une décision prise avec ${s}, les alternatives et la façon de valider ton choix.`, `For ${title}, explain a decision using ${s}, alternatives and how you validated it.`, `بالنسبة إلى ${title}، اشرح قراراً باستخدام ${s} والبدائل وكيف تحققت منه.`))
      : input.interviewType === 'SYSTEM_DESIGN'
        ? [pick(`Pour ${title}, comment concevrais-tu une solution qui reste fiable quand le nombre d’utilisateurs augmente ?`, `For ${title}, how would you design a solution that remains reliable as usage grows?`, `بالنسبة إلى ${title}، كيف تصمم حلاً موثوقاً مع ازدياد عدد المستخدمين؟`)]
        : input.interviewType === 'MANAGERIAL'
          ? [pick('Raconte une situation où tu as coordonné un travail collectif et clarifié les priorités.', 'Describe a situation where you coordinated a team effort and clarified priorities.', 'صف موقفاً نسقت فيه عملاً جماعياً وحددت الأولويات.')]
          : input.interviewType === 'CASE_STUDY'
            ? [pick(`Pour ${title}, comment analyserais-tu un problème métier avant de proposer une solution ?`, `For ${title}, how would you analyse a business problem before proposing a solution?`, `بالنسبة إلى ${title}، كيف تحلل مشكلة تجارية قبل اقتراح حل؟`)]
      : [input.interviewType === 'SITUATIONAL'
        ? pick(`Pour ${title}, deux priorités urgentes entrent en conflit. Comment décides-tu et communiques-tu ton choix ?`, `For ${title}, two urgent priorities conflict. How would you decide and communicate?`, `في ${title}، كيف تتعامل مع أولويتين عاجلتين متعارضتين؟`)
        : input.interviewType === 'BEHAVIORAL'
          ? pick('Raconte un désaccord dans un projet : ton rôle, ton action et le résultat réel.', 'Describe a project disagreement: your role, action and actual outcome.', 'صف خلافاً في مشروع ودورك وإجراءك والنتيجة الفعلية.')
          : pick(`Pourquoi ${title} ? Relie deux attentes de l’offre à tes expériences réelles.`, `Why ${title}? Connect two job requirements to your real experience.`, `لماذا ${title}؟ اربط متطلبين من العرض بخبرتك الفعلية.`)];
    return { method: 'guided_practice', questions: [
      pick(`Présente ton parcours en 90 secondes pour ${title}. Quelle expérience est la plus pertinente ?`, `Introduce yourself in 90 seconds for ${title}. Which experience is most relevant?`, `قدّم مسيرتك في 90 ثانية لمنصب ${title}. ما الخبرة الأكثر صلة؟`),
      ...specific,
      ...evidence.map(quote => pick(`Ton CV indique « ${quote.trim()} ». Pour ${title}, explique ton action personnelle, une difficulté rencontrée et le résultat que tu peux attester.`, `Your CV states “${quote.trim()}”. For ${title}, explain your own contribution, one challenge and the outcome you can substantiate.`, `تذكر سيرتك «${quote.trim()}». لمنصب ${title}، اشرح مساهمتك وتحدياً واجهته والنتيجة التي تستطيع إثباتها.`)),
      ...(job.description ? [pick(`Dans cette offre, quelle mission te paraît la plus difficile ? Comment l’aborderais-tu pendant tes 30 premiers jours ?`, 'Which responsibility in this job description is most challenging? How would you approach it in your first 30 days?', 'ما أصعب مسؤولية في هذا العرض وكيف ستتعامل معها خلال أول 30 يوماً؟')] : []),
      pick('Choisis un projet réel : situation, responsabilité, action personnelle, résultat et leçon apprise.', 'Choose a real project: situation, responsibility, your action, outcome and lesson.', 'اختر مشروعاً حقيقياً: الموقف والمسؤولية وإجراءك والنتيجة والدرس.'),
      pick('Que sais-tu de cette entreprise à partir de sources vérifiables ? Que voudrais-tu confirmer avec le recruteur ?', 'What do you know about this company from verifiable sources? What would you confirm with the recruiter?', 'ماذا تعرف عن الشركة من مصادر موثوقة وما الذي ستتحقق منه مع مسؤول التوظيف؟'),
      pick('Quelles questions poserais-tu sur les objectifs, l’équipe et les critères de réussite du poste ?', 'What would you ask about goals, the team and success criteria for this role?', 'ما أسئلتك حول الأهداف والفريق ومعايير النجاح في المنصب؟'),
    ] };
  }
  const answer = String(input.answer || ''), words = answer.trim().split(/\s+/).length;
  return { method: 'guided_practice',
    good: [pick(`Réponse enregistrée : ${words} mots. Tu peux la comparer à la question ci-dessus.`, `Answer saved: ${words} words. Compare it with the question above.`, `تم حفظ الإجابة: ${words} كلمة. قارنها بالسؤال أعلاه.`)],
    improve: [words < 40 ? pick('Ajoute un exemple réel et précise ton action personnelle et son résultat.', 'Add a real example, your own action and its result.', 'أضف مثالاً حقيقياً وإجراءك ونتيجته.') : pick('Vérifie que ton exemple répond directement à la question, puis retire les détails secondaires.', 'Check that your example directly answers the question, then remove secondary details.', 'تحقق أن المثال يجيب مباشرة عن السؤال واحذف التفاصيل الثانوية.')],
    betterAnswer: pick('Dans [contexte réel], je devais [objectif]. J’ai [action personnelle]. Le résultat a été [résultat vérifié]. J’en ai appris [leçon].', 'In [real context], my goal was [goal]. I [personal action]. The result was [verified outcome]. I learned [lesson].', 'في [سياق حقيقي] كان هدفي [الهدف]. قمت بـ[إجراء]. النتيجة [نتيجة موثقة]. تعلمت [الدرس].'),
    keywords: skills,
    clarity: pick('Grille de relecture : contexte → action → résultat. Aucune analyse IA disponible pour cette réponse.', 'Review checklist: context → action → outcome. AI analysis is unavailable for this answer.', 'قائمة مراجعة: السياق ثم الإجراء ثم النتيجة. تحليل الذكاء الاصطناعي غير متاح لهذه الإجابة.'),
    relevance: pick('Relis la question et vérifie toi-même que tu réponds à chacun de ses points.', 'Reread the question and check that you address each part.', 'أعد قراءة السؤال وتحقق من الإجابة عن كل نقطة.'),
    wordsPerMinute: input.speakingSeconds ? Math.round(words * 60 / Number(input.speakingSeconds)) : null,
  };
}
