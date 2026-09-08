import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación no encontrado en la URL.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(({ data }) => {
        setStatus('success');
        setMessage(data.message);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Error al verificar el correo';
        setStatus('error');
        setMessage(msg);
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground">Verificando tu correo...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="mb-4 text-5xl">✅</div>
              <h2 className="mb-2 text-xl font-bold text-green-600">¡Correo verificado!</h2>
              <p className="mb-6 text-muted-foreground">{message}</p>
              <Button asChild>
                <Link to="/login">Ir al login</Link>
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="mb-4 text-5xl">❌</div>
              <h2 className="mb-2 text-xl font-bold text-destructive">Error de verificación</h2>
              <p className="mb-6 text-muted-foreground">{message}</p>
              <Button variant="outline" asChild>
                <Link to="/register">Volver al registro</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
