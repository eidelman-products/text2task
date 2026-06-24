export default function HomepageDemoVideo() {
  return (
    <video
      src="/landing/text2task-demo.mp4"
      poster="/landing/text2task-demo-project-preview-poster.png"
      controls
      playsInline
      preload="metadata"
      aria-describedby="homepage-demo-description"
      className="aspect-video w-full bg-slate-100 object-cover"
    >
      Your browser does not support the video tag.
    </video>
  );
}
