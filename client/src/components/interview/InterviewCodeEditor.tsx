import React, { useCallback, useRef, useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { CodingProblem } from '../../types/interview'

interface InterviewCodeEditorProps {
  problem: CodingProblem
  onCodeChange?: (code: string) => void
  onNotepadChange?: (notepad: string) => void
  onSubmit?: (code: string, timeComplexity?: string, spaceComplexity?: string) => void
  isMonitoring?: boolean
  readOnly?: boolean
  onTimerExpire?: () => void
  showTimer?: boolean
}

function getTimeLimit(difficulty: string): number {
  switch (difficulty) {
    case 'easy': return 15 * 60
    case 'medium': return 25 * 60
    case 'hard': return 40 * 60
    default: return 25 * 60
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const InterviewCodeEditor: React.FC<InterviewCodeEditorProps> = ({
  problem,
  onCodeChange,
  onNotepadChange,
  onSubmit,
  isMonitoring = true,
  readOnly = false,
  onTimerExpire,
  showTimer = true,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(problem.language || 'cpp')
  const [activeTab, setActiveTab] = useState<'code' | 'notepad'>('code')
  const [notepadContent, setNotepadContent] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(getTimeLimit(problem.difficulty))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeComplexity, setTimeComplexity] = useState('')
  const [spaceComplexity, setSpaceComplexity] = useState('')
  const editorRef = useRef<any>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const availableLanguages = ['javascript', 'python', 'cpp', 'java']

  const getMonacoLang = (lang: string) => {
    switch (lang) {
      case 'cpp': return 'cpp'
      case 'python': return 'python'
      case 'java': return 'java'
      default: return 'javascript'
    }
  }

  const getStarterCode = useCallback(() => {
    if (problem.starterCodes?.[selectedLanguage]) return problem.starterCodes[selectedLanguage]
    const fallback = problem.language || 'cpp'
    if (problem.starterCodes?.[fallback]) return problem.starterCodes[fallback]
    return problem.starterCode || ''
  }, [problem, selectedLanguage])

  // Reset timer on problem change
  useEffect(() => {
    if (showTimer && !readOnly) setTimeRemaining(getTimeLimit(problem.difficulty))
    setNotepadContent('')
    setTimeComplexity('')
    setSpaceComplexity('')
    // Reset language to problem's default language when problem changes
    setSelectedLanguage(problem.language || 'cpp')
  }, [problem.id])

  // Timer countdown
  useEffect(() => {
    if (!showTimer || readOnly) return
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
          onTimerExpire?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current) }
  }, [showTimer, readOnly, onTimerExpire])

  const handleSubmit = useCallback(async () => {
    if (!editorRef.current || !onSubmit || isSubmitting) return
    const code = editorRef.current.getValue()
    if (!code.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit(code, timeComplexity || undefined, spaceComplexity || undefined)
    } catch (e) {
      console.error('Submit error:', e)
    } finally {
      setIsSubmitting(false)
    }
  }, [onSubmit, isSubmitting, timeComplexity, spaceComplexity])

  return (
    <div className="web-code-editor-container">
      <div className="web-coding-layout">
        {/* Left: Problem Description */}
        <div className="web-question-panel">
          <div className="web-question-header">
            <h3>{problem.title || 'Coding Problem'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {showTimer && !readOnly && (
                <div className="web-timer-display" style={{ color: timeRemaining > 300 ? '#4caf50' : timeRemaining > 60 ? '#ff9800' : '#f44336' }}>
                  ⏱ {formatTime(timeRemaining)}
                </div>
              )}
              {isMonitoring && (
                <span className="web-monitoring-indicator">
                  <div className="web-pulse-dot"></div> Monitoring
                </span>
              )}
            </div>
          </div>
          <div className="web-question-content">
            <div className="web-question-section">
              <h4>Problem Description</h4>
              <p>{problem.description || ''}</p>
            </div>
            {problem.constraints && (
              <div className="web-question-section">
                <h4>Constraints</h4>
                <ul>
                  {Array.isArray(problem.constraints)
                    ? problem.constraints.map((c, i) => <li key={i}>{c}</li>)
                    : <li>{problem.constraints}</li>}
                </ul>
              </div>
            )}
            {problem.examples && (
              <div className="web-question-section">
                <h4>Examples</h4>
                {Array.isArray(problem.examples)
                  ? problem.examples.map((ex, i) => (
                    <div key={i} className="web-example">
                      {typeof ex === 'string' ? <pre>{ex}</pre> : (
                        <div>
                          <p><strong>Input:</strong> {ex.input}</p>
                          <p><strong>Output:</strong> {ex.output}</p>
                          {ex.explanation && <p><strong>Explanation:</strong> {ex.explanation}</p>}
                        </div>
                      )}
                    </div>
                  ))
                  : <pre>{typeof problem.examples === 'string' ? problem.examples : JSON.stringify(problem.examples, null, 2)}</pre>}
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="web-editor-panel">
          <div className="web-editor-header">
            <div className="web-editor-tabs">
              <button className={`web-editor-tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>Code</button>
              <button className={`web-editor-tab ${activeTab === 'notepad' ? 'active' : ''}`} onClick={() => setActiveTab('notepad')}>Notepad</button>
            </div>
            {activeTab === 'code' && (
              <select 
                className="web-language-selector" 
                value={selectedLanguage} 
                onChange={(e) => {
                  const newLang = e.target.value
                  setSelectedLanguage(newLang)
                }} 
                disabled={readOnly}
              >
                {availableLanguages.map((l) => (
                  <option key={l} value={l}>{l === 'cpp' ? 'C++' : l === 'python' ? 'Python 3' : l === 'java' ? 'Java' : 'JavaScript'}</option>
                ))}
              </select>
            )}
          </div>

          {activeTab === 'code' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  key={`${problem.id}-${selectedLanguage}`}
                  height="100%"
                  language={getMonacoLang(selectedLanguage)}
                  theme="vs-dark"
                  defaultValue={getStarterCode()}
                  onMount={(editor) => { 
                    editorRef.current = editor
                    // Set initial value when editor mounts to ensure correct starter code
                    const starterCode = getStarterCode()
                    if (starterCode) {
                      editor.setValue(starterCode)
                      onCodeChange?.(starterCode)
                    }
                  }}
                  onChange={(value) => onCodeChange?.(value || '')}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    readOnly,
                    fontSize: 14,
                    wordWrap: 'on',
                  }}
                />
              </div>
              {onSubmit && !readOnly && (
                <div className="web-code-editor-footer">
                  <div className="web-complexity-inputs">
                    <div className="web-complexity-input">
                      <label>Time Complexity</label>
                      <input type="text" placeholder="e.g. O(n log n)" value={timeComplexity} onChange={(e) => setTimeComplexity(e.target.value)} />
                    </div>
                    <div className="web-complexity-input">
                      <label>Space Complexity</label>
                      <input type="text" placeholder="e.g. O(n)" value={spaceComplexity} onChange={(e) => setSpaceComplexity(e.target.value)} />
                    </div>
                  </div>
                  <button className="web-submit-button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Solution'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="web-notepad-container">
              <textarea
                className="web-notepad-textarea"
                placeholder="Use this space for notes, pseudocode, or thinking through the problem."
                value={notepadContent}
                onChange={(e) => { setNotepadContent(e.target.value); onNotepadChange?.(e.target.value) }}
                disabled={readOnly}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .web-code-editor-container {
          width: 100%;
          height: 80vh;
          display: flex;
          flex-direction: column;
          background: #1e1e1e;
          border-radius: 12px;
          overflow: hidden;
        }

        .web-coding-layout {
          display: flex;
          height: 100%;
          gap: 1px;
          overflow: hidden;
        }

        /* Left Column: Question Panel */
        .web-question-panel {
          flex: 0 0 45%;
          background: #1e1e1e;
          border-right: 1px solid #333;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
        }

        .web-question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #2d2d30;
          border-bottom: 1px solid #333;
          border-top-left-radius: 12px;
        }

        .web-question-header h3 {
          margin: 0;
          color: #ffffff;
          font-size: 18px;
          font-weight: 600;
        }

        .web-timer-display {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          min-width: 80px;
          font-variant-numeric: tabular-nums;
        }

        .web-monitoring-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #4caf50;
          font-size: 12px;
        }

        .web-pulse-dot {
          width: 8px;
          height: 8px;
          background: #4caf50;
          border-radius: 50%;
          animation: web-pulse 2s infinite;
        }

        @keyframes web-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .web-question-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #1e1e1e;
        }

        .web-question-section {
          margin-bottom: 24px;
        }

        .web-question-section h4 {
          color: #4fc3f7;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .web-question-section p {
          margin: 0 0 12px 0;
          color: #cccccc;
          font-size: 14px;
          line-height: 1.6;
        }

        .web-question-section ul {
          margin: 0;
          padding-left: 20px;
          color: #cccccc;
          font-size: 14px;
          line-height: 1.6;
        }

        .web-question-section li {
          margin-bottom: 8px;
        }

        .web-example {
          background: #252526;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .web-example pre {
          margin: 0;
          color: #cccccc;
          font-size: 13px;
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .web-example p {
          margin: 0 0 8px 0;
          color: #cccccc;
          font-size: 13px;
        }

        .web-example p:last-child {
          margin-bottom: 0;
        }

        .web-example strong {
          color: #4fc3f7;
        }

        /* Right Column: Editor Panel */
        .web-editor-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #1e1e1e;
          overflow: hidden;
          border-top-right-radius: 12px;
          border-bottom-right-radius: 12px;
        }

        .web-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #2d2d30;
          border-bottom: 1px solid #333;
          height: 52px;
          border-top-right-radius: 12px;
        }

        .web-editor-tabs {
          display: flex;
          height: 100%;
          align-items: flex-end;
          padding-left: 16px;
        }

        .web-editor-tab {
          background: transparent;
          color: #969696;
          border: none;
          padding: 10px 16px;
          height: 100%;
          cursor: pointer;
          font-size: 13px;
          outline: none;
          border-bottom: 2px solid transparent;
          display: flex;
          align-items: center;
        }

        .web-editor-tab:hover {
          color: #e0e0e0;
        }

        .web-editor-tab.active {
          color: #ffffff;
          border-bottom: 2px solid #007acc;
          border-right: none;
          border-top: none;
        }

        .web-notepad-container {
          flex: 1;
          display: flex;
          background: #1e1e1e;
          overflow: hidden;
        }

        .web-notepad-textarea {
          flex: 1;
          background: #1e1e1e;
          color: #d4d4d4;
          border: none;
          resize: none;
          padding: 16px;
          font-family: 'Consolas', 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.5;
          outline: none;
        }

        .web-language-selector {
          background: #007acc;
          color: white;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          outline: none;
          transition: background 0.2s;
          margin-right: 16px;
        }

        .web-language-selector:hover:not(:disabled) {
          background: #005a9e;
        }

        .web-language-selector:disabled {
          background: #555;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .web-code-editor-footer {
          height: 70px;
          padding-left: 16px;
          padding-right: 16px;
          background: #2d2d30;
          border-top: 1px solid #333;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          gap: 16px;
        }

        .web-complexity-inputs {
          width: 40%;
          display: flex;
          gap: 8px;
          flex: 1;
          align-items: center;
        }

        .web-complexity-input {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          max-width: 160px;
        }

        .web-complexity-input label {
          font-size: 11px;
          font-weight: 500;
          color: #cccccc;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .web-complexity-input input {
          width: 80%;
          padding: 6px 10px;
          background: #1e1e1e;
          border: 1px solid #444;
          border-radius: 4px;
          color: #ffffff;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          outline: none;
          transition: border-color 0.2s;
        }

        .web-complexity-input input:focus {
          border-color: #007acc;
        }

        .web-complexity-input input::placeholder {
          color: #666;
        }

        .web-submit-button {
          padding: 10px 24px;
          background: #007acc;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .web-submit-button:hover:not(:disabled) {
          background: #005a9e;
        }

        .web-submit-button:disabled {
          background: #555;
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* Scrollbar styling for question panel */
        .web-question-content::-webkit-scrollbar {
          width: 8px;
        }

        .web-question-content::-webkit-scrollbar-track {
          background: #1e1e1e;
        }

        .web-question-content::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 4px;
        }

        .web-question-content::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>
    </div>
  )
}
