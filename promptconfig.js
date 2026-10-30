// promptconfig.js
// Central configuration for prompt templates used by the HyperAssistant extension.

// Default prompt for translating selected text (Highlight Feature - "Text Translate")
// Aims for accurate translation into English, returning only the translated text.
export const PROMPT_TEXT_TRANSLATE = `Translate the Input Text into [text_translate_target_language] with a [emotion] tone, automatically detect the source language of the Input Text, ensure the translation is accurate and natural.
When the tone is "conversation", translate in a casual, friendly, and natural conversational style suitable for chat messages or casual messaging - use everyday language, contractions, and informal expressions as appropriate.
Preserve all meaningless phrases and code snippets exactly as they are, do not translate them.
Return only the translated text without any explanations, formatting, or added quotation marks unless originally present.
Input Text:
[inputText]`;

// Prompt for Summarize Selected Text (Highlight Feature - "Summarize")
// Produces a short, easy-to-understand summary in the user's Default Target Language.
export const PROMPT_SUMMARIZE_SELECTED_TEXT = `Summarize the Input Text into [text_translate_target_language].
Output MUST be in [text_translate_target_language].

Write:
1) A one-sentence TL;DR.
2) Key points as bullet lines starting with "- ". Choose the number of bullet points based on the amount of content:
	- Short input: 1-3 bullets
	- Medium input: 3-6 bullets
	- Long/complex input: 6-10 bullets
	Focus on the most important ideas only.

Rules:
- Keep it short, clear, and easy to understand.
- Do not add information that is not present in the Input Text.
- Preserve all code snippets exactly as they are.
- Return ONLY the TL;DR line and the bullet lines. No headings, no markdown fences, no extra commentary.

Input Text:
[inputText]`;


// Default prompt for the sidebar translation box ("Fast Translate")
// Aims for accurate translation into English, detecting source language, returning only translated text.
export const PROMPT_FAST_TRANSLATE = `Translate the Input Text into [target_language], automatically detect the source language of the Input Text, ensure the translation is accurate and natural.
Preserve all meaningless phrases and code snippets exactly as they are, do not translate them.
Return only the translated text without any explanations, formatting, or added quotation marks unless originally present.

Input Text:
[inputText]`;

// Prompt for Image Translation feature
// Translates text detected in images into the target language
export const PROMPT_IMAGE_TRANSLATE = `Translate the text in the Input Image into [text_translate_target_language] with a [emotion] tone, automatically detect the source language of the Input Text, ensure the translation is accurate and natural, suitable for the context.
When the tone is "conversation", translate in a casual, friendly, and natural conversational style suitable for chat messages or casual messaging - use everyday language, contractions, and informal expressions as appropriate.
Preserve all meaningless phrases and code snippets exactly as they are, do not translate them. 
Return only the translated text without any explanations, formatting, or added quotation marks unless originally present.
If no text is detected in the image, return only "No text found in the image." without any additional explanation.
Input Image:
[ImageURL]`;

// Example of adding more prompts in the future:
// export const PROMPT_TEXT_TRANSLATE_TO_SPANISH = `Translate... into Spanish... [selectedText] ...`;
// export const PROMPT_FAST_TRANSLATE_VI_EN = `Translate from Vietnamese to English... [inputText] ...`;

// console.log("[HyperAssistant] Prompt config loaded."); // Log to confirm loading

// Prompt for Full Page Translation (Batch Key-Value Dictionary)
// Maps numerical IDs to paragraph/heading text, reducing token overhead by 50%
export const PROMPT_PAGE_BATCH_TRANSLATE = `You are a professional web translator. Translate the text values in the following JSON object into [target_language].
Rules:
1. Preserve all numerical keys ("1", "2", etc.) exactly as they are.
2. Return ONLY a strictly valid JSON object mapping each numerical key to its translated text.
3. Ensure the translation is natural, fluent, and accurately captures the full context of each block.
4. If a value contains inline HTML tags (such as <a>, <b>, <i>, <code>, <span>), PRESERVE the exact HTML tags and their attributes (like href), translating ONLY the human-readable text inside.
5. Preserve all product names, trademarks, and symbols as appropriate.
6. Do NOT include markdown code blocks (such as \`\`\`json or \`\`\`), no explanations, no commentary. Output MUST start with { and end with }.

Input JSON:
[inputJSON]`;