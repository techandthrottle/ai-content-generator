import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export async function generateKeywords(prompt: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: "You are a keyword generator. Generate relevant keywords and tags for the given video prompt. Return only the keywords as a comma-separated list."
      }, {
        role: "user",
        content: `Generate keywords for this video prompt: "${prompt}"`
      }],
      max_tokens: 100,
      temperature: 0.5
    });

    const keywords = response.choices[0]?.message?.content?.split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0) || [];

    return keywords;
  } catch (error) {
    console.error('Error generating keywords:', error);
    return [];
  }
}