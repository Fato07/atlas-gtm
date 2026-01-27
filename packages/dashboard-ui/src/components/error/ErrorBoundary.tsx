/**
 * ErrorBoundary component
 * Catches and handles React errors gracefully
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global error boundary for the dashboard application
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);

    this.setState({ errorInfo });

    // In production, you would send this to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred in the application.
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <span className="mt-2 block font-mono text-xs text-destructive">
                    {this.state.error.message}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="rounded-md border bg-muted/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    View error details
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={this.handleReload}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={this.handleGoHome}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                If this problem persists, please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
