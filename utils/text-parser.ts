import { ParsedQuestion, QuestionType } from '@/types/quiz';

interface ParseResult {
  questions: ParsedQuestion[];
  warnings: string[];
}

function parseMultipleAnswerLetters(raw: string, optionLetters: string[], options: string[]): string[] {
  const letters = raw
    .split(/[,;&\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-Z]$/.test(s));

  const resolved: string[] = [];
  for (const letter of letters) {
    const idx = optionLetters.indexOf(letter);
    if (idx >= 0 && idx < options.length) {
      resolved.push(options[idx]);
    }
  }
  return resolved;
}

export function parseTextToQuestions(text: string): ParseResult {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    return { questions: [], warnings: ['No text content found.'] };
  }

  const answerKey: Record<string, string> = {};
  const answerKeyPattern = /^(?:answer\s*key|answers?)\s*:?\s*$/i;
  const answerKeyLinePattern = /^(\d+)\s*[.:)]\s*([A-Za-z](?:\s*[,;&\s]\s*[A-Za-z])*)\s*$/;

  let answerKeyStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (answerKeyPattern.test(lines[i])) {
      answerKeyStartIndex = i;
      break;
    }
  }

  if (answerKeyStartIndex >= 0) {
    for (let i = answerKeyStartIndex + 1; i < lines.length; i++) {
      const match = answerKeyLinePattern.exec(lines[i]);
      if (match) {
        answerKey[match[1]] = match[2].toUpperCase();
      } else {
        const regex = /(\d+)\s*[.:]\s*([A-Za-z](?:\s*[,;&\s]\s*[A-Za-z])*)/g;
        let inlineMatch;
        while ((inlineMatch = regex.exec(lines[i])) !== null) {
          answerKey[inlineMatch[1]] = inlineMatch[2].toUpperCase();
        }
      }
    }
  }

  const contentLines = answerKeyStartIndex >= 0 ? lines.slice(0, answerKeyStartIndex) : lines;

  const optionPattern = /^([A-Za-z])\s*[.):\-]\s*(.+)/;
  const answerInlinePattern = /^(?:answers?|correct(?:\s*answers?)?|key)\s*[.:]\s*(.+)/i;

  let currentQuestion: {
    number: string;
    text: string;
    options: string[];
    optionLetters: string[];
    answers: string[];
    type: QuestionType;
  } | null = null;

  const pushQuestion = () => {
    if (!currentQuestion) return;

    let correctAnswer: string | string[] = '';
    let verified = false;
    let type = currentQuestion.type;

    if (currentQuestion.answers.length > 0) {
      if (currentQuestion.answers.length === 1) {
        correctAnswer = currentQuestion.answers[0];
      } else {
        correctAnswer = currentQuestion.answers;
        type = 'multiple-select';
      }
      verified = true;
    } else if (answerKey[currentQuestion.number]) {
      const keyRaw = answerKey[currentQuestion.number];
      const resolved = parseMultipleAnswerLetters(keyRaw, currentQuestion.optionLetters, currentQuestion.options);
      if (resolved.length > 1) {
        correctAnswer = resolved;
        type = 'multiple-select';
        verified = true;
      } else if (resolved.length === 1) {
        correctAnswer = resolved[0];
        verified = true;
      } else {
        correctAnswer = keyRaw;
        verified = false;
        warnings.push(`Answer key "${keyRaw}" for Q${currentQuestion.number} doesn't match options.`);
      }
    } else {
      verified = false;
      warnings.push(`Q${currentQuestion.number}: No correct answer found. Marked as unverified.`);
    }

    const isTF = currentQuestion.options.length === 2 &&
      currentQuestion.options.some(o => /^true$/i.test(o)) &&
      currentQuestion.options.some(o => /^false$/i.test(o));
    if (isTF) {
      type = 'true-false';
    }

    questions.push({
      text: currentQuestion.text,
      options: currentQuestion.options,
      correctAnswer,
      type,
      verified,
    });
  };

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];

    const numMatch = /^(?:Q(?:uestion)?\s*)?(\d+)\s*[.):\-]\s*(.+)/i.exec(line);
    if (numMatch) {
      pushQuestion();
      currentQuestion = {
        number: numMatch[1],
        text: numMatch[2].trim(),
        options: [],
        optionLetters: [],
        answers: [],
        type: 'short-answer',
      };
      continue;
    }

    if (currentQuestion) {
      const optMatch = optionPattern.exec(line);
      if (optMatch) {
        currentQuestion.optionLetters.push(optMatch[1].toUpperCase());
        currentQuestion.options.push(optMatch[2].trim());

        if (currentQuestion.options.length > 1) {
          currentQuestion.type = 'multiple-choice';
        }
        continue;
      }

      const ansMatch = answerInlinePattern.exec(line);
      if (ansMatch) {
        const ansRaw = ansMatch[1].trim();
        const hasMultipleLetters = /^[A-Za-z]\s*[,;&\s]\s*[A-Za-z]/.test(ansRaw);
        const isSingleLetter = /^[A-Za-z]$/.test(ansRaw);

        if (hasMultipleLetters) {
          const resolved = parseMultipleAnswerLetters(ansRaw, currentQuestion.optionLetters, currentQuestion.options);
          if (resolved.length > 0) {
            currentQuestion.answers = resolved;
          }
        } else if (isSingleLetter) {
          const idx = currentQuestion.optionLetters.indexOf(ansRaw.toUpperCase());
          if (idx >= 0) {
            currentQuestion.answers = [currentQuestion.options[idx]];
          } else {
            currentQuestion.answers = [ansRaw.toUpperCase()];
          }
        } else {
          currentQuestion.answers = [ansRaw];
        }
        continue;
      }

      if (line.length > 0 && !optionPattern.test(line)) {
        currentQuestion.text += ' ' + line;
      }
    }
  }

  pushQuestion();

  if (questions.length === 0) {
    warnings.push('Could not detect any questions. Try numbered format: "1. Question text" with options "A) Option"');
  }

  return { questions, warnings };
}
