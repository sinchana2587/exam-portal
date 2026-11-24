/**
 * Layout-Aware Question Paper Parser
 * Robust multi-pass parser for academic examination question papers.
 * Detects dynamic modules (3, 5, 8, etc.), question boundaries, options (A-D), answer keys,
 * code snippets, mathematical formulas, and associates extracted images.
 */

export function parseQuestionPaper(rawText, extractedImages = [], defaultMeta = {}) {
  const lines = rawText.split(/\r?\n/).map(l => l.trimEnd());
  
  // 1. Extract Header Metadata (Semester, Subject Name, Subject Code, Date, Marks)
  const meta = {
    semester: defaultMeta.semester || null,
    subjectName: defaultMeta.subjectName || '',
    subjectCode: defaultMeta.subjectCode || '',
    totalMarks: null,
    duration: '',
    department: defaultMeta.department || 'CSE'
  };

  // Inspect the top 30 lines for institutional header info
  const headerLines = lines.slice(0, 35);
  for (const line of headerLines) {
    const l = line.trim();
    if (!meta.subjectCode) {
      const codeMatch = l.match(/(?:Course|Sub(?:ject)?)\s*Code\s*[:\-]?\s*([0-9]{2}[A-Z]{2,4}[0-9]{2,3}[A-Z]?|[A-Z]{2,4}[0-9]{2,4})/i) ||
                        l.match(/\b(21[A-Z]{2}[0-9]{2}|18[A-Z]{2}[0-9]{2})\b/);
      if (codeMatch) meta.subjectCode = codeMatch[1].toUpperCase();
    }
    if (!meta.semester) {
      const semMatch = l.match(/(?:Semester|Sem)\s*[:\-]?\s*([1-8]|I{1,3}|IV|V?I{0,3})/i);
      if (semMatch) {
        const val = semMatch[1].toUpperCase();
        const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
        meta.semester = romanMap[val] || parseInt(val, 10) || null;
      }
    }
    if (!meta.subjectName) {
      const subMatch = l.match(/(?:Subject|Course(?:\s*Title)?)\s*[:\-]?\s*([A-Za-z0-9\s&,–\-]+)/i);
      if (subMatch && subMatch[1].length > 3 && !subMatch[1].toLowerCase().includes('code')) {
        meta.subjectName = subMatch[1].trim();
      }
    }
  }

  // 2. Identify Module Headings and Split Document into Module Blocks
  // Common module headings: "MODULE 1", "Module - 2", "UNIT I", "Unit - 3", "PART - A", "Section 1"
  const moduleRegex = /^(?:MODULE|UNIT|PART|SECTION)\s*[-:]?\s*([0-9IVXLCDM]+|[A-Z])(?:\s*[:\-–]\s*(.*))?$/i;

  // Track raw module slices
  const moduleSlices = [];
  let currentSlice = {
    moduleNumber: 1,
    title: 'Module 1',
    lines: [],
    detectedExplicitly: false
  };

  const romanToInt = (roman) => {
    const map = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 };
    return map[roman.toUpperCase()] || null;
  };

  const letterToInt = (letter) => {
    const code = letter.toUpperCase().charCodeAt(0);
    return code >= 65 && code <= 90 ? (code - 64) : null;
  };

  let hasExplicitModules = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const modMatch = trimmed.match(moduleRegex);

    if (modMatch) {
      hasExplicitModules = true;
      // If previous slice has lines, push it
      if (currentSlice.lines.length > 0) {
        moduleSlices.push(currentSlice);
      }

      const rawNum = modMatch[1];
      const extraTitle = modMatch[2] ? ` - ${modMatch[2].trim()}` : '';
      let modNum = parseInt(rawNum, 10);
      if (isNaN(modNum)) {
        modNum = romanToInt(rawNum) || letterToInt(rawNum) || (moduleSlices.length + 1);
      }

      currentSlice = {
        moduleNumber: modNum,
        title: `Module ${modNum}${extraTitle}`,
        lines: [],
        detectedExplicitly: true
      };
      continue;
    }

    currentSlice.lines.push(line);
  }

  if (currentSlice.lines.length > 0) {
    moduleSlices.push(currentSlice);
  }

  // If no explicit module headings were found, check if questions are sequentially numbered
  // and we can either group them into Module 1 or distribute them
  if (!hasExplicitModules && moduleSlices.length === 1) {
    // Single module containing all lines
    moduleSlices[0].title = 'Module 1';
    moduleSlices[0].moduleNumber = 1;
  }

  // 3. Parse Questions within Each Module Slice
  // Question starting patterns:
  // "1.", "Q1.", "Q.1", "1)", "Question 1:", "1 - ", etc.
  const questionStartRegex = /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})(?:[\.\)\-:]\s*|\s+)(.*)$/i;
  
  // Option patterns:
  // (A) Text, A. Text, A) Text, [A] Text
  const optionRegex = /^(?:\(([A-D])\)|\[([A-D])\]|([A-D])[\.\)])\s*(.*)$/i;
  
  // Answer patterns:
  // Ans: A, Answer: (B), Key: C, Correct Answer: D
  const answerRegex = /(?:Ans(?:wer)?|Key|Correct(?:\s*Answer)?)\s*[:\-\.]?\s*[\(\[]?([A-Da-d])[\)\]]?/i;

  // Header / Footer / Table of contents noise lines to ignore
  const isNoiseLine = (t) => {
    if (!t) return true;
    if (/^(?:DATA STRUCTURES AND ALGORITHMS.*|.*MCQ Question Bank.*|.*Question Bank Page \d+ of \d+|Page \d+ of \d+|Topics covered:.*|Total (?:Modules|Questions).*|Module Coverage Questions|Questions|Q\d+\s*[-–—]\s*Q\d+)$/i.test(t)) return true;
    if (/^Module\s+\d+\s+(?:Introduction|Stacks|Singly|Trees|Graphs|Coverage|Target)/i.test(t) && /Q\d+\s*[-–—]\s*Q\d+/i.test(t)) return true;
    if (/^Module\s+\d+\s+Coverage\s+Questions/i.test(t)) return true;
    if (/^Each module contains \d+ multiple-choice questions/i.test(t)) return true;
    return false;
  };

  const usedImageIndexes = new Set();
  const takeNextUnassignedImage = () => {
    const index = extractedImages.findIndex((_, candidateIndex) => !usedImageIndexes.has(candidateIndex));
    if (index < 0) return null;
    usedImageIndexes.add(index);
    return extractedImages[index];
  };
  const parsedModules = [];
  const seenQuestionNumbers = new Set();
  const duplicateQuestionNumbers = [];
  let answerKeyStarted = false;

  for (const slice of moduleSlices) {
    const parsedQuestions = [];
    let currentQ = null;
    let currentOptKey = null;
    let inCodeBlock = false;

    const flushCurrentQuestion = () => {
      if (currentQ) {
        const optionKeys = ['A', 'B', 'C', 'D'];
        const missingOpts = optionKeys.filter(k => !currentQ.options[k].text.trim() && !currentQ.options[k].image);
        // Discard TOC table lines / pseudo-questions that have no options and no answer
        if (missingOpts.length === 4 && !currentQ.correctAnswer) {
          currentQ = null;
          currentOptKey = null;
          return;
        }

        // Validation checks for this question
        const errors = [];
        if (!currentQ.questionText.trim() && !currentQ.questionImage) {
          errors.push('Missing question text and image');
        }
        
        if (missingOpts.length > 0) {
          errors.push(`Missing option(s): ${missingOpts.join(', ')}`);
        }

        if (!currentQ.correctAnswer) {
          // Note: Notice prompt: "Do not automatically assign an answer when the source document does not clearly specify it."
          // But record as validation notice for COE verification
          currentQ.isAnswerUncertain = true;
        }

        // Duplicate question number check
        const questionKey = `${slice.moduleNumber}:${currentQ.questionNumber}`;
        if (seenQuestionNumbers.has(questionKey)) {
          duplicateQuestionNumbers.push(currentQ.questionNumber);
          errors.push(`Duplicate Question Number ${currentQ.questionNumber}`);
        } else {
          seenQuestionNumbers.add(questionKey);
        }

        currentQ.validationErrors = errors;
        parsedQuestions.push(currentQ);
        currentQ = null;
        currentOptKey = null;
      }
    };

    for (let i = 0; i < slice.lines.length; i++) {
      const line = slice.lines[i];
      const trimmed = line.trim();

      if (/^(?:(?:complete\s+)?answer\s+key|solutions?)\b/i.test(trimmed)) {
        answerKeyStarted = true;
        break;
      }

      if (!trimmed) {
        // If we are in question text or code block, preserve line break
        if (currentQ && !currentOptKey) {
          currentQ.questionText += '\n';
        }
        continue;
      }

      if (isNoiseLine(trimmed)) {
        continue;
      }

      // Check for code snippet markers (``` or standard indentation/keywords)
      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (currentQ && !currentOptKey) {
          currentQ.questionText += `\n${trimmed}\n`;
        }
        continue;
      }

      // If inside code block, append raw line to question
      if (inCodeBlock && currentQ && !currentOptKey) {
        currentQ.questionText += `\n${line}`;
        continue;
      }

      // Check if line is an answer indicator
      const ansMatch = trimmed.match(answerRegex);
      if (ansMatch && currentQ) {
        currentQ.correctAnswer = ansMatch[1].toUpperCase();
        currentQ.isAnswerUncertain = false;
        continue;
      }

      // Check if line starts a new question
      const qMatch = trimmed.match(questionStartRegex);
      // Ensure it's not an option (e.g. "A. something") or subpart when already in question
      const isActuallyQuestion = qMatch && (
        !currentQ || 
        parseInt(qMatch[1], 10) === currentQ.questionNumber + 1 ||
        parseInt(qMatch[1], 10) > currentQ.questionNumber ||
        (currentOptKey !== null && parseInt(qMatch[1], 10) > 0)
      );

      if (isActuallyQuestion) {
        flushCurrentQuestion();
        const qNum = parseInt(qMatch[1], 10);
        const initialText = qMatch[2] || '';
        const matchingImageIndex = extractedImages.findIndex((image, imageIndex) =>
          !usedImageIndexes.has(imageIndex) &&
          Number(image.moduleNumber) === Number(slice.moduleNumber) &&
          Number(image.questionNumber) === qNum
        );
        if (matchingImageIndex >= 0) usedImageIndexes.add(matchingImageIndex);

        currentQ = {
          questionId: `q_${slice.moduleNumber}_${qNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          questionNumber: qNum,
          moduleNumber: slice.moduleNumber,
          questionText: initialText,
          questionImage: matchingImageIndex >= 0 ? extractedImages[matchingImageIndex].url : null,
          options: {
            A: { text: '', image: null },
            B: { text: '', image: null },
            C: { text: '', image: null },
            D: { text: '', image: null }
          },
          correctAnswer: null, // Only set when clearly specified
          isAnswerUncertain: false,
          uncertainModule: !slice.detectedExplicitly,
          confidence: 0.95,
          validationErrors: []
        };
        currentOptKey = null;
        continue;
      }

      // Split options that share a line, including two-column PDF/OCR output such as "(A) ... (B) ...".
      const optionMarkers = [...trimmed.matchAll(/(?<![A-Za-z0-9])(?:\((DP|[A-D]|0|O|©|®|€)\)|\[(DP|[A-D]|0|O|©|®|€)\]|(DP|[A-D]|0|O|©|®|€)[.)])/gi)];
      const optionKeys = optionMarkers.map(match => {
        const rawKey = (match[1] || match[2] || match[3]).toUpperCase();
        if (['0', 'O', 'DP'].includes(rawKey)) return 'D';
        if (['©', '€'].includes(rawKey)) return 'C';
        if (rawKey === '®') return 'B';
        return rawKey;
      });
      const startsWithOption = optionMarkers.length > 0 && optionMarkers[0].index <= 1;
      const orderedOptionRun = optionKeys.every((key, index) => index === 0 || key.charCodeAt(0) === optionKeys[index - 1].charCodeAt(0) + 1);
      if (currentQ && startsWithOption && optionMarkers.length >= 2 && orderedOptionRun) {
        optionMarkers.forEach((match, index) => {
          const key = optionKeys[index];
          const contentStart = match.index + match[0].length;
          const contentEnd = optionMarkers[index + 1]?.index ?? trimmed.length;
          const optionText = trimmed.slice(contentStart, contentEnd).trim();
          if (optionText) {
            const existingText = currentQ.options[key].text;
            currentQ.options[key].text = existingText ? `${existingText} ${optionText}` : optionText;
          }
        });
        currentOptKey = null;
        continue;
      }

      // Check if line has multiple inline options e.g. "(A) Apple  (B) Banana  (C) Cherry  (D) Date"
      const inlineMatch = trimmed.match(/(?:\(A\)|\[A\]|A\))\s*(.+?)\s*(?:\(B\)|\[B\]|B\))\s*(.+?)\s*(?:\(C\)|\[C\]|C\))\s*(.+?)\s*(?:\(D\)|\[D\]|D\))\s*(.+)/i);
      if (inlineMatch && currentQ) {
        currentQ.options.A.text = inlineMatch[1].trim();
        currentQ.options.B.text = inlineMatch[2].trim();
        currentQ.options.C.text = inlineMatch[3].trim();
        currentQ.options.D.text = inlineMatch[4].trim();
        currentOptKey = null;
        continue;
      }

      // Check if line starts a single option (A, B, C, D)
      const optMatch = trimmed.match(optionRegex);
      if (optMatch && currentQ) {
        const key = (optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(key)) {
          currentOptKey = key;
          currentQ.options[key].text = (optMatch[4] || '').trim();
          continue;
        }
      }

      // Check for inline image placeholder or diagram tag like [Image], [Diagram], or associate extracted image
      const imageTagMatch = trimmed.match(/\[(?:Image|Diagram|Figure|Photo|Pic)(?:\s*(\d+))?\]/i);
      if (imageTagMatch && currentQ) {
        const img = currentOptKey || !currentQ.questionImage ? takeNextUnassignedImage() : null;
        if (img) {
          if (currentOptKey) {
            currentQ.options[currentOptKey].image = img.url;
          } else if (!currentQ.questionImage) {
            currentQ.questionImage = img.url;
          }
        }
        continue;
      }

      // If we are currently accumulating text:
      if (currentQ) {
        if (currentOptKey) {
          // Append to active option
          currentQ.options[currentOptKey].text += (currentQ.options[currentOptKey].text ? ' ' : '') + trimmed;
        } else {
          // Append to question text
          currentQ.questionText += (currentQ.questionText ? '\n' : '') + trimmed;
        }
      }
    }

    flushCurrentQuestion();

    if (parsedQuestions.length > 0) {
      parsedModules.push({
        moduleNumber: slice.moduleNumber,
        title: slice.title,
        questions: parsedQuestions
      });
    }
    if (answerKeyStarted) break;
  }

  // Some documents repeat a module heading before an appendix or a batch of
  // added questions. Fold those slices back into one worksheet per module and
  // keep the question order numeric.
  const mergedModules = new Map();
  for (const module of parsedModules) {
    if (!mergedModules.has(module.moduleNumber)) {
      mergedModules.set(module.moduleNumber, { ...module, questions: [] });
    }
    mergedModules.get(module.moduleNumber).questions.push(...module.questions);
  }
  parsedModules.splice(0, parsedModules.length, ...[...mergedModules.values()]
    .sort((a, b) => a.moduleNumber - b.moduleNumber)
    .map(module => ({
      ...module,
      questions: module.questions.sort((a, b) => a.questionNumber - b.questionNumber)
    })));

  // A single embedded image in a question-bank PDF commonly belongs to Q1.
  // Do not spread multiple unlocated image streams across successive questions:
  // PDF object order is not page position, so that silently corrupts row mapping.
  const unassignedImages = extractedImages.filter((_, index) => !usedImageIndexes.has(index));
  const firstQuestion = parsedModules[0]?.questions[0];
  if (unassignedImages.length === 1 && firstQuestion && !firstQuestion.questionImage) {
    firstQuestion.questionImage = unassignedImages[0].url;
  }

  // 5. Calculate Global Verification Summary
  let totalQuestions = 0;
  let missingTextCount = 0;
  let missingOptionsCount = 0;
  let missingAnswersCount = 0;
  let unassignedModulesCount = 0;
  let uncertainAnswersCount = 0;

  for (const m of parsedModules) {
    totalQuestions += m.questions.length;
    for (const q of m.questions) {
      if (!q.questionText.trim() && !q.questionImage) missingTextCount++;
      const optKeys = ['A', 'B', 'C', 'D'];
      const emptyOpts = optKeys.filter(k => !q.options[k].text.trim() && !q.options[k].image);
      if (emptyOpts.length > 0) missingOptionsCount++;
      if (!q.correctAnswer) missingAnswersCount++;
      if (q.isAnswerUncertain) uncertainAnswersCount++;
      if (q.uncertainModule) unassignedModulesCount++;
    }
  }

  const confidenceScore = totalQuestions > 0
    ? Math.max(0.4, Math.round((1 - ((missingTextCount + missingOptionsCount * 0.5 + missingAnswersCount * 0.2) / (totalQuestions * 2))) * 100) / 100)
    : 0.5;

  return {
    metadata: {
      ...meta,
      totalModules: parsedModules.length,
      totalQuestions
    },
    modules: parsedModules,
    verification: {
      totalQuestions,
      missingQuestionText: missingTextCount,
      missingOptions: missingOptionsCount,
      missingAnswers: missingAnswersCount,
      duplicateQuestionNumbers: duplicateQuestionNumbers.length,
      duplicateNumbersList: duplicateQuestionNumbers,
      unassignedModules: unassignedModulesCount,
      uncertainAnswers: uncertainAnswersCount,
      unreadableImages: 0,
      confidenceScore,
      isVerificationReady: totalQuestions > 0 && missingTextCount === 0 && missingOptionsCount === 0
    }
  };
}

/** Map spreadsheet question banks directly into the same normalized question model. */
export function parseQuestionPaperRows(rows, defaultMeta = {}) {
  const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    module: ['module', 'moduleno', 'modulenumber', 'unit', 'unitno', 'part', 'section'],
    number: ['questionnumber', 'questionno', 'qno', 'qnumber', 'number', 'serialnumber', 'serialno', 'slnumber', 'slno', 'sl', 'sno', 'slno.'],
    text: ['question', 'questions', 'questiontext', 'questionstatement', 'questiondescription', 'problem', 'statement', 'questionstem'],
    image: ['questionimage', 'questionimg', 'imagequestion', 'questionfigure', 'questiondiagram'],
    answer: ['correct', 'correctanswer', 'correctanswerletter', 'correctoption', 'correctchoice', 'answer', 'answerkey', 'key', 'keyanswer'],
    A: ['a', 'atext', 'aoption', 'optiona', 'optionatext', 'choicea', 'choiceatext', 'answera', 'option1', 'choice1'],
    B: ['b', 'btext', 'boption', 'optionb', 'optionbtext', 'choiceb', 'choicebtext', 'answerb', 'option2', 'choice2'],
    C: ['c', 'ctext', 'coption', 'optionc', 'optionctext', 'choicec', 'choicectext', 'answerc', 'option3', 'choice3'],
    D: ['d', 'dtext', 'doption', 'optiond', 'optiondtext', 'choiced', 'choicedtext', 'answerd', 'option4', 'choice4'],
    imageA: ['optionaimage', 'optionaimg', 'imagea', 'imga', 'choiceaimage', 'choiceaimg'],
    imageB: ['optionbimage', 'optionbimg', 'imageb', 'imgb', 'choicebimage', 'choicebimg'],
    imageC: ['optioncimage', 'optioncimg', 'imagec', 'imgc', 'choicecimage', 'choicecimg'],
    imageD: ['optiondimage', 'optiondimg', 'imaged', 'imgd', 'choicedimage', 'choicedimg']
  };
  const fields = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [
    key,
    names.map(normalize)
  ]));
  const get = (row, field) => {
    const entry = Object.entries(row || {}).find(([key]) => fields[field].includes(normalize(key)));
    return entry ? String(entry[1] ?? '').trim() : '';
  };

  const modules = new Map();
  let fallbackNumber = 0;
  for (const row of rows || []) {
    const questionText = get(row, 'text');
    const options = Object.fromEntries(['A', 'B', 'C', 'D'].map(key => [key, {
      text: get(row, key),
      image: get(row, `image${key}`) || null
    }]));
    const questionImage = get(row, 'image') || null;
    if (!questionText && !questionImage && !Object.values(options).some(option => option.text || option.image)) continue;

    fallbackNumber += 1;
    const moduleValue = get(row, 'module');
    const moduleMatch = moduleValue.match(/\d+|\b[IVX]+\b/i);
    const romanMap = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
    const rawModule = moduleMatch?.[0] || '1';
    const moduleNumber = Number(rawModule) || romanMap[rawModule.toUpperCase()] || 1;
    const explicitNumber = get(row, 'number').match(/\d+/)?.[0];
    const questionNumber = Number(explicitNumber) || fallbackNumber;
    const rawAnswer = get(row, 'answer').toUpperCase().match(/\b([A-D])\b/)?.[1] || null;
    const validationErrors = [];
    if (!questionText && !questionImage) validationErrors.push('Missing question text and image');
    const missing = ['A', 'B', 'C', 'D'].filter(key => !options[key].text && !options[key].image);
    if (missing.length) validationErrors.push(`Missing option(s): ${missing.join(', ')}`);

    const question = {
      questionId: `q_${moduleNumber}_${questionNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      questionNumber,
      moduleNumber,
      questionText,
      questionImage,
      options,
      correctAnswer: rawAnswer,
      isAnswerUncertain: !rawAnswer,
      uncertainModule: !moduleValue,
      confidence: questionText ? 0.9 : 0.55,
      validationErrors
    };
    if (!modules.has(moduleNumber)) modules.set(moduleNumber, []);
    modules.get(moduleNumber).push(question);
  }

  const parsedModules = [...modules.entries()]
    .sort(([a], [b]) => a - b)
    .map(([moduleNumber, questions]) => ({ moduleNumber, title: `Module ${moduleNumber}`, questions }));
  const allQuestions = parsedModules.flatMap(module => module.questions);
  const missingQuestionText = allQuestions.filter(question => !question.questionText && !question.questionImage).length;
  const missingOptions = allQuestions.filter(question => ['A', 'B', 'C', 'D'].some(key => !question.options[key].text && !question.options[key].image)).length;
  const missingAnswers = allQuestions.filter(question => !question.correctAnswer).length;
  const duplicateNumbers = [];
  for (const module of parsedModules) {
    const seen = new Set();
    for (const question of module.questions) {
      if (seen.has(question.questionNumber)) duplicateNumbers.push(question.questionNumber);
      seen.add(question.questionNumber);
    }
  }

  const totalQuestions = allQuestions.length;
  return {
    metadata: {
      semester: defaultMeta.semester || null,
      subjectName: defaultMeta.subjectName || '',
      subjectCode: defaultMeta.subjectCode || '',
      department: defaultMeta.department || 'CSE',
      totalModules: parsedModules.length,
      totalQuestions
    },
    modules: parsedModules,
    verification: {
      totalQuestions,
      missingQuestionText,
      missingOptions,
      missingAnswers,
      duplicateQuestionNumbers: duplicateNumbers.length,
      duplicateNumbersList: duplicateNumbers,
      unassignedModules: allQuestions.filter(question => question.uncertainModule).length,
      uncertainAnswers: missingAnswers,
      unreadableImages: 0,
      confidenceScore: totalQuestions ? Math.max(0.4, 1 - (missingQuestionText + missingOptions * 0.5 + missingAnswers * 0.2) / (totalQuestions * 2)) : 0,
      isVerificationReady: totalQuestions > 0 && missingQuestionText === 0 && missingOptions === 0
    }
  };
}

