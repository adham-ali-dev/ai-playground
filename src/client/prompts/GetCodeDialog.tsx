import { useState } from "react";
import { Code } from "lucide-react";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { codeFor, type CodeInput, type CodeLanguage } from "@/lib/code";

const LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: "curl", label: "cURL" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

/** The current prompt as a request to run anywhere. */
export function GetCodeDialog({ input }: { input: CodeInput }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<CodeLanguage>("curl");
  const code = codeFor(language, input);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Code data-icon="inline-start" />
        Get code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Get code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              value={language}
              onValueChange={(value) => setLanguage(value as CodeLanguage)}
            >
              <TabsList>
                {LANGUAGES.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <CopyButton value={code} successMessage="Copied the code." size="sm" />
          </div>
          <pre
            data-testid="code-snippet"
            className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-relaxed"
          >
            {code}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
