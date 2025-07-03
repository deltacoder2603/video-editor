'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Server, 
  Shield, 
  Plus, 
  Trash2, 
  AlertTriangle,
  BookOpen,
  Zap,
  CheckCircle
} from 'lucide-react';

interface ProfanitySettingsProps {
  onSettingsChange: (settings: ProfanitySettings) => void;
  className?: string;
}

export interface ProfanitySettings {
  useAI: boolean;
  useAllProfanity: boolean;
  apiKey: string;
  customWords: string[];
  strictMode: boolean;
  confidenceThreshold: number;
  languages: string[];
}

export default function ProfanitySettings({ onSettingsChange, className }: ProfanitySettingsProps) {
  const [settings, setSettings] = useState<ProfanitySettings>({
    useAI: false, // Disabled since backend handles this
    useAllProfanity: true, // Backend uses multilingual filter
    apiKey: '',
    customWords: [],
    strictMode: false,
    confidenceThreshold: 0.7,
    languages: ['hindi', 'english'] // Backend supports these
  });

  const updateSettings = (newSettings: Partial<ProfanitySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    onSettingsChange(updated);
  };

  // Initialize with default settings on mount
  useEffect(() => {
    onSettingsChange(settings);
  }, []);

  const addCustomWord = (word: string) => {
    if (word.trim() && !settings.customWords.includes(word.trim())) {
      const updatedWords = [...settings.customWords, word.trim()];
      updateSettings({ customWords: updatedWords });
    }
  };

  const removeCustomWord = (word: string) => {
    const updatedWords = settings.customWords.filter(w => w !== word);
    updateSettings({ customWords: updatedWords });
  };

  const supportedLanguages = [
    { code: 'hindi', name: 'Hindi/Urdu' },
    { code: 'english', name: 'English' },
    { code: 'spanish', name: 'Spanish' },
    { code: 'french', name: 'French' },
    { code: 'german', name: 'German' },
    { code: 'arabic', name: 'Arabic' }
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Backend Profanity Detection</span>
          <Badge variant="outline" className="gap-1">
            <Server className="w-3 h-3" />
            Server-side
          </Badge>
        </CardTitle>
        <CardDescription>
          Profanity detection powered by Whisper transcription and multilingual filtering
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backend Status */}
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800 dark:text-green-200">
              Backend Processing Active
            </span>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <p>• Whisper AI for accurate speech transcription</p>
            <p>• @tekdi/multilingual-profanity-filter for detection</p>
            <p>• FFmpeg for precise audio segment muting</p>
            <p>• Support for multiple languages and dialects</p>
          </div>
        </div>

        {/* Language Support */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Supported Languages</span>
          </h4>
          <div className="flex flex-wrap gap-2">
            {supportedLanguages.map((lang) => (
              <Badge
                key={lang.code}
                variant={settings.languages.includes(lang.code) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  const updatedLanguages = settings.languages.includes(lang.code)
                    ? settings.languages.filter(l => l !== lang.code)
                    : [...settings.languages, lang.code];
                  updateSettings({ languages: updatedLanguages });
                }}
              >
                {lang.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Backend automatically detects and filters profanity in selected languages
          </p>
        </div>

        <Separator />

        {/* Detection Settings */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Detection Settings</span>
          </h4>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="strict-mode" className="font-medium">
                Strict Mode
              </Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                More aggressive filtering - catches subtle inappropriate content
              </p>
            </div>
            <Switch
              id="strict-mode"
              checked={settings.strictMode}
              onCheckedChange={(checked) => updateSettings({ strictMode: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confidence" className="font-medium">
              Confidence Threshold: {Math.round(settings.confidenceThreshold * 100)}%
            </Label>
            <input
              id="confidence"
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={settings.confidenceThreshold}
              onChange={(e) => updateSettings({ confidenceThreshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Higher values = more strict filtering, fewer false positives
            </p>
          </div>
        </div>

        <Separator />

        {/* Custom Words - Note Only */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Custom Words (Frontend Only)</span>
          </h4>
          
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium">Note:</p>
                <p>Custom words are stored locally for reference only. Backend uses its own comprehensive profanity database.</p>
              </div>
            </div>
          </div>

          {settings.customWords.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Local custom words ({settings.customWords.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {settings.customWords.map((word, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {word}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomWord(word)}
                      className="h-4 w-4 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Backend Processing Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <BookOpen className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Backend Processing Pipeline</span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>• <strong>Step 1:</strong> Extract audio from video using FFmpeg</p>
            <p>• <strong>Step 2:</strong> Transcribe audio using Whisper AI (high accuracy)</p>
            <p>• <strong>Step 3:</strong> Analyze transcript with multilingual profanity filter</p>
            <p>• <strong>Step 4:</strong> Generate precise timestamps for inappropriate content</p>
            <p>• <strong>Step 5:</strong> Mute detected segments while preserving video quality</p>
          </div>
        </div>

        {/* Technical Info */}
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
          <p className="font-medium mb-1">🔧 Technical Implementation:</p>
          <p>
            All profanity detection and filtering is handled server-side using your Express.js backend. 
            The frontend sends video files to the backend, which processes them using Whisper for transcription 
            and the multilingual profanity filter for detection.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export { ProfanitySettings }