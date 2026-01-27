import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Brain {
  id: string;
  name: string;
  vertical: string;
  status: 'draft' | 'active' | 'archived';
}

interface BrainContextValue {
  /** Currently selected brain */
  selectedBrain: Brain | null;
  /** Select a brain by object */
  selectBrain: (brain: Brain | null) => void;
  /** Select a brain by ID (will need to be resolved) */
  selectBrainById: (brainId: string | null) => void;
  /** List of available brains (populated by useBrains hook) */
  availableBrains: Brain[];
  /** Set available brains (called by useBrains hook) */
  setAvailableBrains: (brains: Brain[]) => void;
  /** Loading state */
  isLoading: boolean;
}

const BrainContext = createContext<BrainContextValue | undefined>(undefined);

interface BrainProviderProps {
  children: ReactNode;
}

/**
 * Brain context provider
 * Manages global brain selection state across the dashboard
 */
export function BrainProvider({ children }: BrainProviderProps) {
  const [selectedBrain, setSelectedBrain] = useState<Brain | null>(null);
  const [availableBrains, setAvailableBrains] = useState<Brain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Note: setIsLoading will be used when implementing brain fetching in US3
  void setIsLoading; // Suppress unused variable warning

  const selectBrain = useCallback((brain: Brain | null) => {
    setSelectedBrain(brain);
    // Persist selection to localStorage
    if (brain) {
      localStorage.setItem('atlas-selected-brain', brain.id);
    } else {
      localStorage.removeItem('atlas-selected-brain');
    }
  }, []);

  const selectBrainById = useCallback(
    (brainId: string | null) => {
      if (!brainId) {
        selectBrain(null);
        return;
      }

      const brain = availableBrains.find((b) => b.id === brainId);
      if (brain) {
        selectBrain(brain);
      }
    },
    [availableBrains, selectBrain]
  );

  const handleSetAvailableBrains = useCallback(
    (brains: Brain[]) => {
      setAvailableBrains(brains);

      // Restore selection from localStorage if not already selected
      if (!selectedBrain && brains.length > 0) {
        const savedBrainId = localStorage.getItem('atlas-selected-brain');
        if (savedBrainId) {
          const savedBrain = brains.find((b) => b.id === savedBrainId);
          if (savedBrain) {
            setSelectedBrain(savedBrain);
            return;
          }
        }
        // Default to first active brain if available
        const activeBrain = brains.find((b) => b.status === 'active');
        if (activeBrain) {
          selectBrain(activeBrain);
        }
      }
    },
    [selectedBrain, selectBrain]
  );

  return (
    <BrainContext.Provider
      value={{
        selectedBrain,
        selectBrain,
        selectBrainById,
        availableBrains,
        setAvailableBrains: handleSetAvailableBrains,
        isLoading,
      }}
    >
      {children}
    </BrainContext.Provider>
  );
}

/**
 * Hook to access brain context
 */
export function useBrainContext() {
  const context = useContext(BrainContext);
  if (!context) {
    throw new Error('useBrainContext must be used within a BrainProvider');
  }
  return context;
}
