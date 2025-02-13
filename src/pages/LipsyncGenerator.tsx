import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  { id: 'fal-ai/sync-lipsync', name: 'SYNC-LIPSYNC' },
];

export default function LipsyncGenerator() {
  const navigate = useNavigate();
  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generations, setGenerations] = useState<any[]>([]);
  const [currentGeneration, setCurrentGeneration] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
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
        .filter(doc => doc.data().type === 'lipsync')
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

  const handleVideoUpload = async (file: File) => {
    const storageRef = ref(storage, `temp/video-${Date.now()}-${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setVideoUrl(url);
      setVideo(file);
      setError(null);
    } catch (error) {
      console.error('Error uploading video:', error);
      setError('Failed to upload video. Please try again.');
    }
  };

  const handleAudioUpload = async (file: File) => {
    const storageRef = ref(storage, `temp/audio-${Date.now()}-${file.name}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setAudioUrl(url);
      setAudio(file);
      setError(null);
    } catch (error) {
      console.error('Error uploading audio:', error);
      setError('Failed to upload audio. Please try again.');
    }
  };

  const handleGenerate = async () => {
    if (!video || !audio || !selectedModel || !videoUrl || !audioUrl) return;
    
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    
    try {
      const result = await fal.subscribe(selectedModel, {
        input: {
          video_url: videoUrl,
          audio_url: audioUrl
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
        throw new Error('No output video URL received from the API');
      }

      const newGeneration = {
        id: result.requestId,
        output_url: result.data.video.url
      };

      setCurrentGeneration(newGeneration);
    } catch (error) {
      console.error('Generation failed:', error);
      setError('Failed to generate lipsync video. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const handleSave = async () => {
    if (!currentGeneration?.output_url) return;
    setIsSaving(true);
    setError(null);

    try {
      // Save the output video to Firebase Storage
      const response = await fetch(currentGeneration.output_url);
      const blob = await response.blob();
      const outputStorageRef = ref(storage, `lipsync/output-${Date.now()}.mp4`);
      await uploadBytes(outputStorageRef, blob);
      const outputUrl = await getDownloadURL(outputStorageRef);

      await addDoc(collection(db, 'generations'), {
        id: currentGeneration.id,
        type: 'lipsync',
        video_url: videoUrl,
        audio_url: audioUrl,
        output_url: outputUrl,
        model: selectedModel,
        projectName: projectName || selectedProject,
        created_at: new Date()
      });

      setCurrentGeneration(null);
      setVideo(null);
      setAudio(null);
      setVideoUrl('');
      setAudioUrl('');
      setSelectedModel('');
      setProjectName('');
      setSelectedProject('');

    } catch (error) {
      console.error('Error saving generation:', error);
      setError('Failed to save generation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!currentGeneration?.output_url) return;
    try {
      const link = document.createElement('a');
      link.href = currentGeneration.output_url;
      link.download = `lipsync-${currentGeneration.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setError(null);
    } catch (error) {
      console.error('Error downloading video:', error);
      setError('Failed to download video. Please try again.');
    }
  };

  const handleGenerationClick = (generation: any) => {
    navigate(`/detail/lipsync/${generation.docId}`);
  };

  const filteredGenerations = generations.filter(generation => {
    const matchesProject = !selectedProject || generation.projectName === selectedProject;
    const matchesSearch = !searchQuery || 
      generation.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Lipsync Generator</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

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
              <Label htmlFor="video" className="flex items-center">
                Video
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <input
                type="file"
                id="video"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoUpload(file);
                }}
                className="w-full"
                required
              />
              {videoUrl && (
                <video controls className="w-full mt-2 rounded-md">
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video element.
                </video>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="audio" className="flex items-center">
                Audio
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <input
                type="file"
                id="audio"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAudioUpload(file);
                }}
                className="w-full"
                required
              />
              {audioUrl && (
                <audio controls className="w-full mt-2">
                  <source src={audioUrl} type="audio/mpeg" />
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
                disabled={!video || !audio || !selectedModel || isGenerating}
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
                ) : 'Generate Lipsync'}
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

      {/* Lipsync Generated Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Lipsync Generated Content</h2>
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
                  <source src={generation.output_url} type="video/mp4" />
                  Your browser does not support the video element.
                </video>
                {generation.projectName && (
                  <p className="text-sm font-medium text-primary mb-1">
                    Project: {generation.projectName}
                  </p>
                )}
                <p className="text-sm text-gray-500">
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