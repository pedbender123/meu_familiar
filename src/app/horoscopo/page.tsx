import { HoroscopoForm } from './HoroscopoForm';

export default function HoroscopoPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-tinta text-pergaminho">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <span className="font-corpo text-[0.7rem] tracking-[0.24em] uppercase text-violeta">
          Horóscopo Pessoal
        </span>
        <h1 className="font-display italic text-3xl sm:text-4xl leading-tight text-balance">
          O que o seu Sol e sua Lua já sabem sobre você
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/70 max-w-[38ch]">
          Duas perguntas. Sua leitura sai na hora — sem cadastro, sem enrolação.
        </p>
        <HoroscopoForm />
      </div>
    </main>
  );
}
