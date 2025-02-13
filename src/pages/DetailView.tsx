import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function DetailView() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [generation, setGeneration] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGeneration = async () => {
      if (!id) return;
      
      try {
        const docRef = doc(db, 'generations', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setGeneration({
            ...docSnap.data(),
            docId: docSnap.id
          });
        }
      } catch (error) {
        console.error('Error fetching generation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGeneration();
  }, [id]);

  const handleDownload = () => {
    if (!generation) return;
    const link = document.createElement('a');
    
    if (type === 'broll' || type === 'lipsync') {
      link.href = generation.output_url || generation.video_url;
      link.download = `${type}-${id}.mp4`;
    } else if (type === 'audio') {
      link.href = generation.audio_url;
      link.download = `audio-${id}.wav`;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Generation not found</h2>
        <Button onClick={() => navigate('/')}>Return to Home</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Generation Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Preview</h2>
            {(type === 'broll' || type === 'lipsync') ? (
              <div className="aspect-video">
                <video 
                  controls 
                  className="w-full h-full rounded-md"
                  poster={generation.thumbnail_url}
                >
                  <source src={generation.output_url || generation.video_url} type="video/mp4" />
                  Your browser does not support the video element.
                </video>
                {type === 'lipsync' && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Original Video</h3>
                      <video controls className="w-full rounded-md">
                        <source src={generation.video_url} type="video/mp4" />
                        Your browser does not support the video element.
                      </video>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Original Audio</h3>
                      <audio controls className="w-full">
                        <source src={generation.audio_url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted p-4 rounded-md">
                <audio controls className="w-full">
                  <source src={generation.audio_url} type="audio/wav" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
            <Button onClick={handleDownload} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download {type === 'broll' || type === 'lipsync' ? 'Video' : 'Audio'}
            </Button>
          </div>
        </Card>

        {/* Details Section */}
        <Card className="p-6">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Details</h2>
            
            <div className="space-y-6">
              {type === 'broll' && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Prompt</h3>
                  <p className="bg-muted p-4 rounded-md">{generation.prompt}</p>
                </div>
              )}
              
              {type === 'audio' && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Text</h3>
                  <p className="bg-muted p-4 rounded-md">{generation.text}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Model</h3>
                <p className="bg-muted p-2 rounded-md inline-block">{generation.model}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">Generated On</h3>
                <p className="bg-muted p-2 rounded-md inline-block">
                  {new Date(generation.created_at.seconds * 1000).toLocaleString()}
                </p>
              </div>

              {type === 'audio' && generation.reference_audio_url && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Reference Audio</h3>
                  <audio controls className="w-full">
                    <source src={generation.reference_audio_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                  {type === 'broll' || type === 'lipsync' ? 'Video URL' : 'Audio URL'}
                </h3>
                <p className="bg-muted p-2 rounded-md break-all text-sm">
                  {type === 'broll' || type === 'lipsync' ? 
                    (generation.output_url || generation.video_url) : 
                    generation.audio_url}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}