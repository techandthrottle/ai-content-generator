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
import { Loader2, RotateCw, Download, Save } from "lucide-react";
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { ProjectSelect } from '@/components/ProjectSelect';
import { fal } from "@fal-ai/client";

// Configure fal client
fal.config({
  credentials: import.meta.env.VITE_FAL_KEY
});

const models = [
  { id: 'fal-ai/minimax/video-01-live/image-to-video', name: 'video-01-live/image-to-video' },
];

export default function ImageToVideo() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState('');
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
        .filter(doc => doc.data().type === 'image-to-video')
        .map(doc => ({
          ...doc.data(),
          docId: doc.id
        }));
      
      // Extract unique project names
      const projects = generationsList
        .map(gen => gen.projectName)
        .filter((name): name is string => !!name);
      setExistingProjects(Array.from(new Set(projects)));
      setGenerations(generationsList);
      setIsLoading(false);
    }, (error) => {
      console.error('Error loading generations:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleImageUpload = async (file: File) => {
    const storageRef = ref(storage, `temp/image-${Date.now()}-${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
      setImage(file);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleGenerate = async () => {
    if (!prompt || !image || !selectedModel || !imageUrl) return;
    setIsGenerating(true);
    setProgress(0);
    
    try {
      const result = await fal.subscribe(selectedModel, {
        input: {
          image_url: imageUrl,
          prompt: prompt
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

      const storageRef = ref(storage, `image-to-video/${currentGeneration.id}.mp4`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'generations'), {
        id: currentGeneration.id,
        type: 'image-to-video',
        prompt: currentGeneration.prompt,
        model: selectedModel,
        projectName: projectName || selectedProject,
        image_url: imageUrl,
        created_at: new Date(),
        video_url: downloadURL
      });

      setCurrentGeneration(null);
      setPrompt('');
      setImage(null);
      setImageUrl('');
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
    link.download = `video-${currentGeneration.id}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerationClick = (generation: any) => {
    navigate(`/detail/image-to-video/${generation.docId}`);
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesProject = !selectedProject || generation.projectName === selectedProject;
    const matchesSearch = !searchQuery || 
      generation.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Image to Video Generator</h1>
      
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
              <Label htmlFor="image" className="flex items-center">
                Image
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                type="file"
                id="image"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="w-full"
                required
              />
              {imageUrl && (
                <div className="mt-2">
                  <img
                    src={imageUrl}
                    alt="Uploaded image"
                    className="max-w-full h-auto rounded-md"
                  />
                </div>
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
                disabled={!prompt || !image || !selectedModel || isGenerating}
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
                ) : 'Generate Video'}
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

      {/* Image to Video Generated Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Image to Video Generated Content</h2>
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
                <p className="font-medium truncate">{generation.prompt}</p>
                {generation.projectName && (
                  <p className="text-sm font-medium text-primary mt-1">
                    Project: {generation.projectName}
                  </p>
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