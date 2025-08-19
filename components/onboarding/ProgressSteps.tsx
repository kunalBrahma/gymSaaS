// components/onboarding/ProgressSteps.tsx
import React from 'react';
import { Check, Building, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStepsProps {
  currentStep: number;
}

// Define the steps within the component for clarity
const steps = [
  { number: 1, name: 'Gym Details', icon: Building },
  { number: 2, name: 'Choose Plan', icon: CreditCard },
];
const totalSteps = steps.length;

export const ProgressSteps: React.FC<ProgressStepsProps> = ({ currentStep }) => {
  return (
    <div className="w-full max-w-md mx-auto mb-12">
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    // Base styles
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    // Active state
                    isActive && 'bg-primary border-primary text-primary-foreground scale-110 shadow-lg',
                    // Completed state
                    isCompleted && 'bg-background border-primary text-primary',
                    // Inactive state
                    !isActive && !isCompleted && 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={cn(
                  'mt-2 text-xs font-medium transition-colors', // Reduced typography size
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {step.name}
                </span>
              </div>
              
              {index < totalSteps - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-4 transition-colors duration-500',
                    // Line color based on completion
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};