import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { fal } from "@fal-ai/client";
import { Loader2, RotateCw, Download, Save } from "lucide-react";
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ProjectSelect } from '@/components/ProjectSelect';

// Configure fal client
fal.config({
  credentials: import.meta.env.VITE_FAL_KEY
});

const models = [
  { id: 'fal-ai/f5-tts', name: 'FAL F5-TTS' },
];

export default function TextToAudio() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [currentGeneration, setCurrentGeneration] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'generations'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const generationsList = snapshot.docs
        .filter(doc => doc.data().type === 'audio')
        .map(doc => ({
          ...doc.data(),
          docId: doc.id
        }));
      setGenerations(generationsList);
      
      // Extract unique project names
      const projects = generationsList
        .map(gen => gen.projectName)
        .filter((name): name is string => !!name);
      setExistingProjects(Array.from(new Set(projects)));
      
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading generations:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReferenceAudioUpload = async (file: File) => {
    const storageRef = ref(storage, `reference-audio/${Date.now()}-${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setReferenceAudioUrl(url);
    } catch (error) {
      console.error('Error uploading reference audio:', error);
    }
  };

  const handleGenerate = async () => {
    if (!text || !selectedModel || !referenceAudioUrl) return;

    setIsGenerating(true);
    setCurrentGeneration(null);
    setProgress(0);

    try {
      const result = await fal.subscribe(selectedModel, {
        input: {
          gen_text: text,
          ref_audio_url: referenceAudioUrl,
          model_type: "F5-TTS"
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            const progressLog = update.logs
              .map(log => log.message)
              .find(msg => msg.includes('%'));
            
            if (progressLog) {
              const percentage = parseInt(progressLog.match(/\d+/)?.[0] || '0');
              setProgress(percentage);
            }
          }
        },
      });

      if (!result.data?.audio_url?.url) {
        throw new Error('No audio URL in response');
      }

      const newGeneration = {
        id: result.requestId,
        text,
        created_at: new Date().toISOString(),
        output_url: result.data.audio_url.url
      };

      setCurrentGeneration(newGeneration);

    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleSave = async () => {
    if (!currentGeneration?.output_url) return;
    setIsSaving(true);

    try {
      const response = await fetch(currentGeneration.output_url);
      const blob = await response.blob();

      const storageRef = ref(storage, `audio/${currentGeneration.id}.wav`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'generations'), {
        id: currentGeneration.id,
        type: 'audio',
        text: currentGeneration.text,
        model: selectedModel,
        projectName: projectName || selectedProject,
        reference_audio_url: referenceAudioUrl,
        created_at: new Date(),
        audio_url: downloadURL
      });

      setCurrentGeneration(null);
      setText('');
      setProjectName('');
      setSelectedProject('');

    } catch (error) {
      console.error('Error saving generation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!currentGeneration?.output_url) return;
    const link = document.createElement('a');
    link.href = currentGeneration.output_url;
    link.download = `audio-${currentGeneration.id}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerationClick = (generation: any) => {
    navigate(`/detail/audio/${generation.docId}`);
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesProject = !selectedProject || generation.projectName === selectedProject;
    const matchesSearch = !searchQuery || 
      generation.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Text to Audio Generator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Input */}
        <Card className="p-6">
          <div className="space-y-4">
            <ProjectSelect
              projectName={projectName}
              onProjectNameChange={setProjectName}
              existingProjects={existingProjects}
              selectedProject={selectedProject}
              onProjectSelect={setSelectedProject}
            />

            <div className="space-y-2">
              <Label htmlFor="text">Text</Label>
              <Textarea
                id="text"
                placeholder="Enter the text you want to convert to speech..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference" className="flex items-center">
                Reference Audio
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <input
                type="file"
                id="reference"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReferenceAudioUpload(file);
                }}
                className="w-full"
                required
              />
              {referenceAudioUrl && (
                <audio controls className="w-full mt-2">
                  <source src={referenceAudioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Button 
                onClick={handleGenerate} 
                disabled={!text || !selectedModel || !referenceAudioUrl || isGenerating}
                className="w-full relative"
              >
                {isGenerating ? (
                  <>
                    <div 
                      className="absolute inset-0 bg-primary/30 rounded-md transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                    <div className="relative flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating... {progress}%
                    </div>
                  </>
                ) : 'Generate Audio'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column - Output */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Generation</h2>
            {currentGeneration?.output_url ? (
              <div className="space-y-4">
                <audio controls className="w-full">
                  <source src={currentGeneration.output_url} type="audio/wav" />
                  Your browser does not support the audio element.
                </audio>
                <div className="flex gap-2">
                  <Button onClick={handleGenerate} variant="outline" className="flex-1">
                    <RotateCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    variant="outline" 
                    className="flex-1"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] bg-muted rounded-md">
                <p className="text-muted-foreground">
                  {isGenerating ? 'Generating...' : 'No generation yet'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Audio Generated Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Audio Generated Content</h2>
          <div className="w-64">
            <Input
              placeholder="Search by project name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGenerations.map((generation) => (
              <Card 
                key={generation.id} 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleGenerationClick(generation)}
              >
                <div className="space-y-2">
                  <p className="font-medium truncate">{generation.text}</p>
                  {generation.projectName && (
                    <p className="text-sm font-medium text-primary">
                      Project: {generation.projectName}
                    </p>
                  )}
                  <audio controls className="w-full">
                    <source src={generation.audio_url} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                  <p className="text-sm text-gray-500">
                    Generated on {new Date(generation.created_at.seconds * 1000).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}