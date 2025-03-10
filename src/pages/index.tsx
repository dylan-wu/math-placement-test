import { Button, Container, Title, Group, Stack, Text, TextInput, Paper, Loader, Alert, Textarea, Switch } from "@mantine/core";
import Head from "next/head";
import { useState } from "react";

type Question = {
  question: string;
  answer: string;
  difficulty: string;
  explanation: string;
};

export default function Home() {
  const [lowerBound, setLowerBound] = useState<string>("single digit addition");
  const [upperBound, setUpperBound] = useState<string>("division to 9");
  const [skillsList, setSkillsList] = useState<string>("single digit addition\nsingle digit subtraction\nmultiplication to 5\ndivision to 9");
  const [useSkillsList, setUseSkillsList] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Test state
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [correctStreak, setCorrectStreak] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | 'dontknow' | null>(null);

  const handleGenerateTest = async () => {
    setLoading(true);
    setError(null);
    setTestStarted(true);
    setCorrectStreak(0);
    setUserAnswer("");
    setShowExplanation(false);
    setAnswerStatus(null);
    
    try {
      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousAnswer: null,
          correctStreak: 0,
          currentDifficulty: useSkillsList ? skillsList.split('\n')[0] : 'single digit addition',
          lowerBoundDifficulty: lowerBound,
          upperBoundDifficulty: upperBound,
          useSkillsList: useSkillsList,
          skillsList: useSkillsList ? skillsList.split('\n').filter(skill => skill.trim()) : []
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate question');
      }
      
      const data = await response.json();
      setCurrentQuestion(data);
    } catch (err) {
      setError('Failed to generate question. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async (type: 'submit' | 'dontknow') => {
    if (!currentQuestion) return;
    
    setLoading(true);
    setShowExplanation(true);
    
    let isCorrect = false;
    let answerType: 'correct' | 'incorrect' | 'dontknow' = 'incorrect';
    
    if (type === 'dontknow') {
      answerType = 'dontknow';
      setCorrectStreak(0);
    } else {
      isCorrect = userAnswer.trim() === currentQuestion.answer.trim();
      answerType = isCorrect ? 'correct' : 'incorrect';
      
      if (isCorrect) {
        setCorrectStreak(prev => prev + 1);
      } else {
        setCorrectStreak(0);
      }
    }
    
    setAnswerStatus(answerType);
    
    // Wait a moment to show the explanation
    setTimeout(async () => {
      try {
        const response = await fetch('/api/generate-question', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            previousAnswer: answerType,
            correctStreak: answerType === 'correct' ? correctStreak + 1 : 0,
            currentDifficulty: currentQuestion.difficulty,
            lowerBoundDifficulty: lowerBound,
            upperBoundDifficulty: upperBound,
            useSkillsList: useSkillsList,
            skillsList: useSkillsList ? skillsList.split('\n').filter(skill => skill.trim()) : []
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate next question');
        }
        
        const data = await response.json();
        setCurrentQuestion(data);
        setUserAnswer("");
        setShowExplanation(false);
        setAnswerStatus(null);
      } catch (err) {
        setError('Failed to generate next question. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 3000); // Show explanation for 3 seconds
  };

  const handleNextQuestion = () => {
    setShowExplanation(false);
    setUserAnswer("");
    setAnswerStatus(null);
  };

  return (
    <>
      <Head>
        <title>Math Placement Test</title>
        <meta name="description" content="Math practice test generator" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container size="sm" py="xl">
        <Stack gap="lg">
          <Title order={1} ta="center">Math Practice Test Generator</Title>
          
          {!testStarted ? (
            <>
              <Group justify="center">
                <Switch
                  label="Use skills list instead of bounds"
                  checked={useSkillsList}
                  onChange={(event) => setUseSkillsList(event.currentTarget.checked)}
                />
              </Group>
              
              {!useSkillsList ? (
                <Group justify="center" grow>
                  <TextInput
                    label="Lower Bound Difficulty"
                    placeholder="e.g., single digit addition"
                    value={lowerBound}
                    onChange={(e) => setLowerBound(e.target.value)}
                    description="The minimum difficulty level"
                  />
                  <TextInput
                    label="Upper Bound Difficulty"
                    placeholder="e.g., division to 9"
                    value={upperBound}
                    onChange={(e) => setUpperBound(e.target.value)}
                    description="The maximum difficulty level"
                  />
                </Group>
              ) : (
                <Textarea
                  label="Skills List"
                  placeholder="Enter one skill per line, in order of increasing difficulty"
                  description="List skills in order from easiest to hardest"
                  value={skillsList}
                  onChange={(e) => setSkillsList(e.target.value)}
                  minRows={5}
                  autosize
                />
              )}
              
              <Button 
                variant="filled" 
                size="lg" 
                onClick={handleGenerateTest}
                fullWidth
                loading={loading}
                disabled={useSkillsList 
                  ? !skillsList.trim() 
                  : (!lowerBound.trim() || !upperBound.trim())}
              >
                Generate Test
              </Button>
            </>
          ) : (
            <>
              {error && (
                <Alert color="red" title="Error">
                  {error}
                </Alert>
              )}
              
              {currentQuestion && (
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Text size="lg" fw={500}>
                      Question: {currentQuestion.question}
                    </Text>
                    
                    <Text size="sm" c="dimmed">
                      Difficulty: {currentQuestion.difficulty}
                    </Text>
                    
                    {showExplanation && (
                      <Paper p="sm" bg="gray.0">
                        <Stack gap="xs">
                          <Text fw={700} c={answerStatus === 'correct' ? 'green' : 'red'}>
                            {answerStatus === 'correct' 
                              ? 'Correct!' 
                              : answerStatus === 'dontknow' 
                                ? "Don't worry, let's try an easier one" 
                                : `Incorrect. The correct answer is ${currentQuestion.answer}`}
                          </Text>
                          <Text size="sm">
                            {currentQuestion.explanation}
                          </Text>
                        </Stack>
                      </Paper>
                    )}
                    
                    {!showExplanation && (
                      <>
                        <TextInput
                          label="Your Answer"
                          placeholder="Enter your answer"
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          disabled={loading}
                        />
                        
                        <Group grow>
                          <Button 
                            variant="filled" 
                            onClick={() => handleSubmitAnswer('submit')}
                            disabled={loading || !userAnswer.trim()}
                            loading={loading}
                          >
                            Submit Answer
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            color="gray"
                            onClick={() => handleSubmitAnswer('dontknow')}
                            disabled={loading}
                          >
                            I Don't Know
                          </Button>
                        </Group>
                      </>
                    )}
                    
                    {correctStreak > 0 && (
                      <Text ta="center" fw={700} c="green">
                        Streak: {correctStreak} correct in a row!
                      </Text>
                    )}
                  </Stack>
                </Paper>
              )}
              
              {!currentQuestion && !loading && !error && (
                <Text ta="center">Loading your first question...</Text>
              )}
              
              {loading && (
                <Group justify="center">
                  <Loader />
                </Group>
              )}
              
              <Button 
                variant="subtle" 
                onClick={() => setTestStarted(false)}
                disabled={loading}
              >
                Back to Settings
              </Button>
            </>
          )}
        </Stack>
      </Container>
    </>
  );
}
