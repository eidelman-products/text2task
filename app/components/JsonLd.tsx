type JsonLdPrimitive = string | number | boolean | null;

export type JsonLdObject = {
  readonly [key: string]: JsonLdValue;
};

export type JsonLdValue =
  | JsonLdPrimitive
  | JsonLdObject
  | readonly JsonLdValue[];

type JsonLdProps = Readonly<{
  data: JsonLdObject;
  id?: string;
}>;

export default function JsonLd({ data, id }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
