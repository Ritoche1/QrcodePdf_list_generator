import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h2 className="text-lg font-semibold text-gray-700 mb-2">Page not found</h2>
      <p className="text-sm text-gray-500 mb-6">
        The page you're looking for doesn't exist or was moved.
      </p>
      <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
    </div>
  );
}
