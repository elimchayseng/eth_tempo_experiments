type Props = {
  annotations: string[];
};

export default function AnnotationBox({ annotations }: Props) {
  return (
    <div className="my-2 p-3 bg-indigo-950/50 border border-indigo-800/40 rounded text-sm text-indigo-200 space-y-1">
      {annotations.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}
