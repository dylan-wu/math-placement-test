import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestData = {
  previousAnswer?: 'correct' | 'incorrect' | 'dontknow';
  correctStreak?: number;
  currentDifficulty?: string;
  lowerBoundDifficulty?: string;
  upperBoundDifficulty?: string;
  useSkillsList?: boolean;
  skillsList?: string[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      previousAnswer = null, 
      correctStreak = 0, 
      currentDifficulty = 'single digit addition',
      lowerBoundDifficulty = 'single digit addition',
      upperBoundDifficulty = 'division to 9',
      useSkillsList = false,
      skillsList = []
    } = req.body as RequestData;

    let prompt = '';

    if (useSkillsList && skillsList.length > 0) {
      // Find current skill index
      let currentSkillIndex = skillsList.findIndex(skill => 
        skill.toLowerCase().trim() === currentDifficulty.toLowerCase().trim()
      );
      
      if (currentSkillIndex === -1) {
        // If not found, default to the first skill
        currentSkillIndex = 0;
      }

      // Calculate next skill index based on answer
      let nextSkillIndex = currentSkillIndex;
      
      if (previousAnswer === 'correct') {
        // Move forward by correctStreak steps (but don't exceed the list length)
        nextSkillIndex = Math.min(currentSkillIndex + correctStreak, skillsList.length - 1);
      } else if (previousAnswer === 'incorrect') {
        // Move back by half a level (round down)
        nextSkillIndex = Math.max(currentSkillIndex - 1, 0);
      } else if (previousAnswer === 'dontknow') {
        // Move back by 1.5 levels (round down to 1 or 2 steps back)
        nextSkillIndex = Math.max(currentSkillIndex - 2, 0);
      }

      // Construct the prompt for skills list mode
      prompt = `You are a math question generator meant to create an adaptive placement test. Your procedure should be:

Generate one question at a time.

I have provided a list of skills in order of increasing difficulty:
${skillsList.map((skill, index) => `${index + 1}. ${skill}`).join('\n')}

${!previousAnswer ? `Start with the first skill: ${skillsList[0]}.` : ''}

${previousAnswer === 'incorrect' ? 'The student submitted a wrong answer, so we are moving to an easier skill.' : ''}
${previousAnswer === 'dontknow' ? 'The student submitted "I Don\'t Know", so we are moving to a much easier skill.' : ''}
${previousAnswer === 'correct' ? `The student submitted a correct answer. They have gotten ${correctStreak} correct in a row, so we are moving to a harder skill.` : ''}

Current skill: ${currentDifficulty}
Next skill to test: ${skillsList[nextSkillIndex]}

Generate a question that tests the skill: ${skillsList[nextSkillIndex]}

Respond with a JSON object in this exact format:
{
  "question": "The math question text",
  "answer": "The correct answer (just the number)",
  "difficulty": "${skillsList[nextSkillIndex]}",
  "explanation": "A brief explanation of how to solve this problem",
  "steps": [
    "Step 1: Description of first step in solving",
    "Step 2: Description of second step in solving",
    "..."
  ]
}

The "steps" array should contain 3-5 clear step-by-step instructions showing exactly how to solve the problem, breaking down the solution process into manageable chunks suitable for the difficulty level. Make the steps detailed enough for a student to follow along and learn from.

Do not include any other text in your response, only the JSON object.`;
    } else {
      // Use the original bounds-based prompt
      prompt = `You are a math question generator meant to create an adaptive placement test. Your procedure should be:

Generate one question at a time.

All generated questions are between ${lowerBoundDifficulty} and ${upperBoundDifficulty}.

${!previousAnswer ? `Start with ${lowerBoundDifficulty}.` : ''}

${previousAnswer === 'incorrect' ? 'The student submitted a wrong answer, make the question half a level easier.' : ''}
${previousAnswer === 'dontknow' ? 'The student submitted "I Don\'t Know", make the question 1.5 levels easier.' : ''}
${previousAnswer === 'correct' ? `The student submitted a correct answer. They have gotten ${correctStreak} correct in a row. Increase the difficulty by ${correctStreak} levels.` : ''}

Current difficulty level: ${currentDifficulty}

Do not generate questions below ${lowerBoundDifficulty} difficulty or above ${upperBoundDifficulty} difficulty, even if the adaptive rules would suggest doing so.

Respond with a JSON object in this exact format:
{
  "question": "The math question text",
  "answer": "The correct answer (just the number)",
  "difficulty": "The current difficulty level as a string",
  "explanation": "A brief explanation of how to solve this problem",
  "steps": [
    "Step 1: Description of first step in solving",
    "Step 2: Description of second step in solving",
    "..."
  ]
}

The "steps" array should contain 3-5 clear step-by-step instructions showing exactly how to solve the problem, breaking down the solution process into manageable chunks suitable for the difficulty level. Make the steps detailed enough for a student to follow along and learn from.

Do not include any other text in your response, only the JSON object.`;
    }

    // Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: "Generate a math question based on the criteria above." }
      ],
      response_format: { type: "json_object" }
    });

    // Extract the response
    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const questionData = JSON.parse(responseContent);
    
    return res.status(200).json(questionData);
  } catch (error) {
    console.error('Error generating question:', error);
    return res.status(500).json({ error: 'Failed to generate question' });
  }
} 