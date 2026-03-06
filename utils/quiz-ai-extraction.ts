import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { ParsedQuestion, QuestionImageRegion, QuestionType } from '@/types/quiz';

export interface QuizImageAsset {
  uri: string;
  base64?: string;
  mimeType: string;
  width?: number;
  height?: number;
}

interface ExtractQuizFromImagesParams {
  assets: QuizImageAsset[];
  fallbackTitle: string;
  userHint?: string;
}

interface ExtractQuizFromImagesResult {
  title: string;
  questions: ParsedQuestion[];
  warnings: string[];
}

const imageRegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const extractedQuestionSchema = z.object({
  text: z.string().describe('The exact question stem only. Do not include answer options in this field.'),
  options: z.array(z.string()).describe('Each answer option as a separate array item.'),
  correctAnswers: z.array(z.string()).describe('The exact correct option text. Leave empty if not clearly detectable.'),
  type: z.enum(['multiple-choice', 'multiple-select', 'true-false', 'short-answer']),
  hasImage: z.boolean().describe('True only if this specific question contains its own embedded picture, diagram, graph, figure, or illustration inside the screenshot.'),
  imageDescription: z.string().optional(),
  imageRegion: imageRegionSchema.optional(),
});

const screenshotExtractionSchema = z.object({
  title: z.string().describe('A short title suggestion for the quiz based on the visible content.'),
  questions: z.array(extractedQuestionSchema),
  warnings: z.array(z.string()),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildImageUri(asset: QuizImageAsset): string {
  if (asset.base64) {
    return `data:${asset.mimeType};base64,${asset.base64}`;
  }
  return asset.uri;
}

function sanitizeImageRegion(
  region: z.infer<typeof imageRegionSchema> | undefined,
  asset: QuizImageAsset,
  questionsInScreenshot: number,
  imageDescription?: string,
): QuestionImageRegion | undefined {
  if (!region) {
    return undefined;
  }

  const safeWidth = clamp(region.width, 0, 1);
  const safeHeight = clamp(region.height, 0, 1);
  const safeX = clamp(region.x, 0, 1 - safeWidth);
  const safeY = clamp(region.y, 0, 1 - safeHeight);
  const area = safeWidth * safeHeight;

  console.log('sanitizeImageRegion input:', {
    safeX,
    safeY,
    safeWidth,
    safeHeight,
    area,
    questionsInScreenshot,
    sourceWidth: asset.width,
    sourceHeight: asset.height,
  });

  if (safeWidth < 0.04 || safeHeight < 0.04) {
    console.log('sanitizeImageRegion rejected: region too small');
    return undefined;
  }

  if (safeWidth > 0.94 && safeHeight > 0.94) {
    console.log('sanitizeImageRegion rejected: full-screen region');
    return undefined;
  }

  if (questionsInScreenshot > 1 && (area > 0.45 || safeHeight > 0.72)) {
    console.log('sanitizeImageRegion rejected: suspiciously large for multi-question screenshot');
    return undefined;
  }

  return {
    x: safeX,
    y: safeY,
    width: safeWidth,
    height: safeHeight,
    sourceWidth: asset.width ?? 1,
    sourceHeight: asset.height ?? 1,
    description: imageDescription,
  };
}

function normalizeQuestionType(type: QuestionType, options: string[], correctAnswers: string[]): QuestionType {
  const isTrueFalse = options.length === 2
    && options.some(option => /^true$/i.test(option))
    && options.some(option => /^false$/i.test(option));

  if (isTrueFalse) {
    return 'true-false';
  }

  if (correctAnswers.length > 1) {
    return 'multiple-select';
  }

  if (options.length > 0 && type === 'short-answer') {
    return 'multiple-choice';
  }

  return type;
}

function buildPrompt(index: number, total: number, userHint?: string): string {
  const hintText = userHint?.trim()
    ? `\nUSER REQUEST CONTEXT:\n${userHint.trim()}\n`
    : '';

  return `You are extracting quiz content from exactly ONE screenshot.

This is screenshot ${index + 1} of ${total}. Only extract questions that are visible in THIS screenshot. Do not use or infer content from other screenshots.${hintText}
CRITICAL RULES:
- The question text field must contain ONLY the question stem. Never place answer options inside the question text.
- Every visible answer choice must become a separate item in the options array.
- Preserve the original wording as closely as possible.
- Detect correct answers from visual signals such as checkmarks, crosses, arrows, highlights, underlines, circles, bold emphasis, filled bubbles, or answer keys.
- If the correct answer is not clearly visible, leave correctAnswers empty and add a warning.
- If options are separated by arrows, bullets, dashes, or appear on a single line, split them into separate options.
- If math appears anywhere, convert only the math notation to LaTeX wrapped in $...$ delimiters.
- Set hasImage to true only if the specific question contains an embedded picture, diagram, figure, graph, or illustration that should be shown with the question later.
- When hasImage is true, imageRegion must mark ONLY the embedded visual region, not the entire screenshot, not the question text, and not the answer options.
- imageRegion coordinates must be normalized from 0 to 1 relative to the full screenshot: x, y, width, height.
- If there is no standalone visual region for a question, set hasImage to false and do not return imageRegion.
- Never hallucinate missing questions, options, or images.
- Keep question order exactly as it appears from top to bottom.`;
}

export async function extractQuizFromImages({ assets, fallbackTitle, userHint }: ExtractQuizFromImagesParams): Promise<ExtractQuizFromImagesResult> {
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  let suggestedTitle = fallbackTitle;

  console.log('extractQuizFromImages started:', {
    count: assets.length,
    fallbackTitle,
    hasUserHint: Boolean(userHint?.trim()),
  });

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const imageUri = buildImageUri(asset);

    console.log('extractQuizFromImages processing screenshot:', {
      index,
      mimeType: asset.mimeType,
      hasBase64: Boolean(asset.base64),
      width: asset.width,
      height: asset.height,
    });

    const parsed = await generateObject({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(index, assets.length, userHint) },
            { type: 'image', image: imageUri },
          ],
        },
      ],
      schema: screenshotExtractionSchema,
    });

    console.log('extractQuizFromImages screenshot parsed:', JSON.stringify({
      index,
      title: parsed.title,
      questionCount: parsed.questions.length,
      warnings: parsed.warnings,
    }));

    if (!suggestedTitle || suggestedTitle === fallbackTitle) {
      suggestedTitle = parsed.title || fallbackTitle;
    }

    parsed.warnings.forEach((warning) => {
      warnings.push(`Image ${index + 1}: ${warning}`);
    });

    parsed.questions.forEach((question, questionIndex) => {
      const normalizedType = normalizeQuestionType(question.type, question.options, question.correctAnswers);
      const imageRegion = question.hasImage
        ? sanitizeImageRegion(question.imageRegion, asset, parsed.questions.length, question.imageDescription)
        : undefined;

      if (question.hasImage && !imageRegion) {
        warnings.push(`Image ${index + 1}, question ${questionIndex + 1}: detected a question image but could not isolate it cleanly.`);
      }

      const parsedQuestion: ParsedQuestion = {
        text: question.text.trim(),
        options: question.options.map(option => option.trim()).filter(option => option.length > 0),
        correctAnswer: question.correctAnswers.length > 1
          ? question.correctAnswers.map(answer => answer.trim()).filter(answer => answer.length > 0)
          : question.correctAnswers[0]?.trim() ?? '',
        type: normalizedType,
        verified: question.correctAnswers.length > 0,
        imageUri: imageRegion ? imageUri : undefined,
        imageRegion,
      };

      console.log('extractQuizFromImages mapped question:', {
        screenshotIndex: index,
        questionIndex,
        type: parsedQuestion.type,
        optionCount: parsedQuestion.options.length,
        verified: parsedQuestion.verified,
        hasImage: Boolean(parsedQuestion.imageUri && parsedQuestion.imageRegion),
      });

      questions.push(parsedQuestion);
    });
  }

  if (questions.length === 0) {
    warnings.push('No questions were detected in the provided screenshots.');
  }

  console.log('extractQuizFromImages completed:', {
    title: suggestedTitle,
    questionCount: questions.length,
    warningCount: warnings.length,
  });

  return {
    title: suggestedTitle || fallbackTitle,
    questions,
    warnings,
  };
}
