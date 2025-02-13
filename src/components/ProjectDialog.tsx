import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function ProjectDialog({ onProjectSelect }: { onProjectSelect: (projectId: string) => void }) {
  const [projectName, setProjectName] = useState('');

  const createProject = async () => {
    // TODO: Implement project creation without auth
    onProjectSelect('temp-id');
    setProjectName('');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Create New Project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Enter project name"
            />
          </div>
          <Button onClick={createProject} disabled={!projectName}>
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}