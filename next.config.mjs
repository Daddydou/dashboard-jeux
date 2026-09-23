/** @type {import('next').NextConfig} */
const nextConfig = {
  // Un package-lock.json traîne dans le dossier utilisateur : sans ça,
  // Turbopack le prend pour la racine du workspace.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
