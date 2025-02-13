import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ProjectSelectProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  existingProjects?: string[];
  selectedProject: string;
  onProjectSelect: (value: string) => void;
}

export function ProjectSelect({
  projectName,
  onProjectNameChange,
  existingProjects = [],
  selectedProject,
  onProjectSelect
}: ProjectSelectProps) {
  const uniqueProjects = Array.from(new Set(existingProjects));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="projectName">New Project Name</Label>
        <Input
          id="projectName"
          placeholder="Enter new project name..."
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
        />
      </div>
      
      {uniqueProjects.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="existingProject">or Select Existing Project</Label>
          <Select value={selectedProject} onValueChange={onProjectSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {uniqueProjects.map((project) => (
                <SelectItem key={project} value={project}>
                  {project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}