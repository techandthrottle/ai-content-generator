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
import { generateKeywords } from '@/lib/keywords';
import { useNavigate } from 'react-router-dom';
import { ProjectSelect } from '@/components/ProjectSelect';

// Configure fal client
fal.config({
  credentials: import.meta.env.VITE_FAL_KEY
});

const models = [
  { id: 'fal-ai/minimax/video-01-live', name: 'minimax/video-01-live' },
  { id: 'fal-ai/flux-pro/v1.1-ultra', name: 'flux-pro/v1.1-ultra' },
];

export default function BrollGenerator() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentGeneration, setCurrentGeneration] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  const [searchTag, setSearchTag] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'generations'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const generationsList = snapshot.docs
        .filter(doc => doc.data().type === 'broll')
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

  const handleGenerate = async () => {
    if (!prompt || !selectedModel) return;

    setIsGenerating(true);
    setLogs([]);
    setProgress(0);
    setCurrentGeneration(null);

    try {
      const result = await fal.subscribe(selectedModel, {
        input: {
          prompt: prompt
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            const newLogs = update.logs.map((log) => log.message);
            setLogs(prev => [...prev, ...newLogs]);
            
            const progressLog = newLogs.find(log => log.includes('%'));
            if (progressLog) {
              const percentage = parseInt(progressLog.match(/\d+/)?.[0] || '0');
              setProgress(percentage);
            }
          }
        },
      });

      if (!result.data?.video?.url) {
        throw new Error('No video URL in response');
      }

      const newGeneration = {
        id: result.requestId,
        prompt,
        created_at: new Date().toISOString(),
        output_url: result.data.video.url
      };

      setCurrentGeneration(newGeneration);

    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentGeneration?.output_url) return;
    setIsSaving(true);

    try {
      const response = await fetch(currentGeneration.output_url);
      const blob = await response.blob();

      const storageRef = ref(storage, `broll/${currentGeneration.id}.mp4`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const keywords = await generateKeywords(currentGeneration.prompt);

      await addDoc(collection(db, 'generations'), {
        id: currentGeneration.id,
        type: 'broll',
        prompt: currentGeneration.prompt,
        model: selectedModel,
        projectName: projectName || selectedProject,
        created_at: new Date(),
        video_url: downloadURL,
        keywords: keywords
      });

      setCurrentGeneration(null);
      setPrompt('');
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
    link.download = `broll-${currentGeneration.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerationClick = (generation: any) => {
    navigate(`/detail/broll/${generation.docId}`);
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesProject = !selectedProject || generation.projectName === selectedProject;
    const matchesTag = !searchTag || 
      generation.keywords?.some((keyword: string) => 
        keyword.toLowerCase().includes(searchTag.toLowerCase())
      );
    return matchesProject && matchesTag;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">B-Roll Generator</h1>
      
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
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
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

            <Button 
              onClick={handleGenerate} 
              disabled={!prompt || !selectedModel || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating... {progress > 0 && `(${progress}%)`}
                </>
              ) : 'Generate B-Roll'}
            </Button>

            {isGenerating && logs.length > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <h3 className="font-semibold mb-2">Generation Progress:</h3>
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <p key={index} className="text-sm text-muted-foreground">{log}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right Column - Output */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Generation</h2>
            {currentGeneration?.output_url ? (
              <div className="space-y-4">
                <video controls className="w-full aspect-video rounded-md">
                  <source src={currentGeneration.output_url} type="video/mp4" />
                  Your browser does not support the video element.
                </video>
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

      {/* B-Roll Generated Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">B-Roll Generated Content</h2>
          <div className="w-64">
            <Input
              placeholder="Search by tag..."
              value={searchTag}
              onChange={(e) => setSearchTag(e.target.value)}
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
                {generation.video_url && (
                  <video 
                    className="w-full aspect-video rounded-md mb-2"
                    onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseOut={(e) => {
                      (e.target as HTMLVideoElement).pause();
                      (e.target as HTMLVideoElement).currentTime = 0;
                    }}
                  >
                    <source src={generation.video_url} type="video/mp4" />
                    Your browser does not support the video element.
                  </video>
                )}
                <p className="font-medium truncate">{generation.prompt}</p>
                {generation.projectName && (
                  <p className="text-sm font-medium text-primary mt-1">
                    Project: {generation.projectName}
                  </p>
                )}
                {generation.keywords && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {generation.keywords.slice(0, 3).map((keyword: string, index: number) => (
                      <span 
                        key={index}
                        className="text-xs bg-muted px-2 py-1 rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                    {generation.keywords.length > 3 && (
                      <span className="text-xs bg-muted px-2 py-1 rounded-full">
                        +{generation.keywords.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Generated on {new Date(generation.created_at.seconds * 1000).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}