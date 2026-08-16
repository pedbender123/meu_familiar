'use client';

export function BotaoSair() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/sair', { method: 'POST' });
        window.location.assign('/');
      }}
      className="font-corpo text-xs text-pergaminho/40 hover:text-pergaminho/75 transition underline underline-offset-4"
    >
      sair desta conta
    </button>
  );
}
