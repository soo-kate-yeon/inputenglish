export default function AuthCodeError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-4">Authentication Error</h1>
      <p className="text-lg mb-8">
        There was an error signing you in. Please try again.
      </p>
      <a href="/home" className="text-blue-500 hover:underline">
        Go back to Home
      </a>
    </div>
  );
}
