import { Button, Container, Title, Group, Stack, Text, TextInput, Paper, Loader, Alert, Textarea, Switch, Progress, Box, List } from "@mantine/core";
import Head from "next/head";
import { useState, useEffect, useRef } from "react";

type Question = {
  question: string;
  answer: string;
  difficulty: string;
  explanation: string;
  steps: string[];
};

export default function Home() {
  const [lowerBound, setLowerBound] = useState<string>("single digit addition");
  const [upperBound, setUpperBound] = useState<string>("division to 9");
  const [skillsList, setSkillsList] = useState<string>("single digit addition\nsingle digit subtraction\nmultiplication to 5\ndivision to 9");
  const [useSkillsList, setUseSkillsList] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState<boolean>(false);
  
  // Test state
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [correctStreak, setCorrectStreak] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answerStatus, setAnswerStatus] = useState<'correct' | 'incorrect' | 'dontknow' | null>(null);
  const [nextQuestionData, setNextQuestionData] = useState<Question | null>(null);
  const [showStepByStep, setShowStepByStep] = useState(false);

  // Stopwatch state
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);

  // Start the timer when a new question appears
  useEffect(() => {
    if (currentQuestion && !showExplanation && !loading) {
      // Reset and start the timer
      startTimer();
    }
  }, [currentQuestion, showExplanation, loading]);

  // Timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer functions
  const startTimer = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setElapsedTime(0);
    setIsTimerRunning(true);
    questionStartTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000));
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsTimerRunning(false);
    
    // Calculate final time
    if (questionStartTimeRef.current) {
      const finalTime = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
      setResponseTime(finalTime);
      return finalTime;
    }
    return 0;
  };

  // Calculate streak multiplier based on response time
  const calculateStreakMultiplier = (time: number) => {
    // Multiplier increases for faster responses
    if (time <= 5) {
      return 3; // 3x for extremely fast (≤ 5 seconds)
    } else if (time <= 10) {
      return 2; // 2x for fast (≤ 10 seconds)
    } else if (time <= 15) {
      return 1.5; // 1.5x for moderately fast (≤ 15 seconds)
    } else {
      return 1; // No multiplier for longer times
    }
  };

  const handleGenerateTest = async () => {
    setLoading(true);
    setError(null);
    setTestStarted(true);
    setCorrectStreak(0);
    setUserAnswer("");
    setShowExplanation(false);
    setAnswerStatus(null);
    setElapsedTime(0);
    setResponseTime(null);
    setStreakMultiplier(1);
    setNextQuestionData(null);
    setShowStepByStep(false);
    
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
    
    // Stop the timer and get response time
    const finalTime = stopTimer();
    setLoading(true);
    setShowExplanation(true);
    
    let isCorrect = false;
    let answerType: 'correct' | 'incorrect' | 'dontknow' = 'incorrect';
    let updatedStreak = 0;
    let multiplier = 1;
    
    if (type === 'dontknow') {
      answerType = 'dontknow';
      setCorrectStreak(0);
      setStreakMultiplier(1);
    } else {
      isCorrect = userAnswer.trim() === currentQuestion.answer.trim();
      answerType = isCorrect ? 'correct' : 'incorrect';
      
      if (isCorrect) {
        // Only increase streak if answer was quick enough (under 20 seconds)
        if (finalTime < 20) {
          // Calculate multiplier based on time
          multiplier = calculateStreakMultiplier(finalTime);
          setStreakMultiplier(multiplier);
          
          // Apply streak multiplier for fast answers
          let streakIncrease = 1;
          if (multiplier > 1) {
            streakIncrease = Math.floor(streakIncrease * multiplier);
          }
          
          updatedStreak = correctStreak + streakIncrease;
          setCorrectStreak(updatedStreak);
        } else {
          // For correct but slow answers (20+ seconds), reset streak to 1
          setStreakMultiplier(0);
          updatedStreak = 1; // Reset to streak of 1 for correct but slow answers
          setCorrectStreak(1);
        }
      } else {
        setCorrectStreak(0);
        setStreakMultiplier(1);
        // Show step-by-step solution for incorrect answers
        setShowStepByStep(true);
      }
    }
    
    setAnswerStatus(answerType);
    
    // Generate the next question but don't show it yet
    try {
      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousAnswer: answerType,
          correctStreak: answerType === 'correct' ? updatedStreak : 0,
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
      // Store the next question but don't display it yet
      setNextQuestionData(data);
    } catch (err) {
      setError('Failed to generate next question. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = () => {
    // Move to the next question that was pre-fetched
    if (nextQuestionData) {
      setCurrentQuestion(nextQuestionData);
      setNextQuestionData(null);
      setUserAnswer("");
      setShowExplanation(false);
      setAnswerStatus(null);
      setResponseTime(null);
      setShowStepByStep(false);
    }
  };

  // Format time display (mm:ss format)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
              
              <Group justify="center">
                <Switch
                  label="Show timer during test"
                  checked={showTimer}
                  onChange={(event) => setShowTimer(event.currentTarget.checked)}
                />
              </Group>
              
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
                    {isTimerRunning && showTimer && (
                      <Group justify="apart" mb="xs">
                        <Text size="sm" fw={600} c="blue">Time: {formatTime(elapsedTime)}</Text>
                        <Text size="sm" c="dimmed">Fast answers earn streak multipliers!</Text>
                      </Group>
                    )}
                    
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
                              ? responseTime && responseTime >= 20 
                                ? 'Correct, but a bit slow!' 
                                : 'Correct!' 
                              : answerStatus === 'dontknow' 
                                ? "Don't worry, let's try an easier one" 
                                : `Incorrect. The correct answer is ${currentQuestion.answer}`}
                          </Text>
                          
                          {responseTime !== null && (
                            <Text size="sm" fw={500}>
                              Response time: {formatTime(responseTime)}
                              {answerStatus === 'correct' && responseTime >= 20 && (
                                <Text span c="orange" fw={700}> (Streak reset to 1 - answer took too long)</Text>
                              )}
                              {answerStatus === 'correct' && streakMultiplier > 1 && (
                                <Text span c="green" fw={700}> (Streak multiplier: {streakMultiplier}x!)</Text>
                              )}
                            </Text>
                          )}
                          
                          <Text size="sm">
                            {currentQuestion.explanation}
                          </Text>
                          
                          {/* Step-by-Step Solution Section */}
                          {(showStepByStep || answerStatus === 'dontknow') && currentQuestion.steps && currentQuestion.steps.length > 0 && (
                            <Box mt={10}>
                              <Text fw={600} size="sm" c="blue">Step-by-Step Solution:</Text>
                              <List spacing="xs" size="sm" mt={5} withPadding>
                                {currentQuestion.steps.map((step, index) => (
                                  <List.Item key={index}>
                                    {step}
                                  </List.Item>
                                ))}
                              </List>
                            </Box>
                          )}
                          
                          {/* Show Solution button for correct answers */}
                          {answerStatus === 'correct' && !showStepByStep && currentQuestion.steps && currentQuestion.steps.length > 0 && (
                            <Button 
                              variant="light" 
                              color="blue" 
                              size="xs" 
                              onClick={() => setShowStepByStep(true)}
                              mt={5}
                            >
                              Show Solution Steps
                            </Button>
                          )}
                          
                          {/* Next Question Button */}
                          <Button 
                            variant="filled" 
                            color="green" 
                            mt={10}
                            onClick={handleNextQuestion}
                            disabled={!nextQuestionData}
                          >
                            Next Question
                          </Button>
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
                      <Paper p="xs" radius="md" bg="green.0">
                        <Stack gap={5}>
                          <Text ta="center" fw={700} c="green">
                            Streak: {correctStreak} correct in a row!
                          </Text>
                          {!showTimer && (
                            <Text size="xs" ta="center" c="dimmed">
                              Fast answers multiply your streak, even though the timer is hidden!
                              Answers taking 20+ seconds will reset your streak to 1.
                            </Text>
                          )}
                          {showTimer && (
                            <Text size="xs" ta="center" c="dimmed">
                              Answer quickly to multiply your streak! 
                              Answers taking 20+ seconds will reset your streak to 1.
                            </Text>
                          )}
                        </Stack>
                      </Paper>
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
