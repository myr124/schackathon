import { Card, CardHeader, CardTitle } from "@/components/ui/card";
 

interface VoiceCardProps {
    question: string;
    audioBase64: string;
}

const VoiceCard: React.FC<VoiceCardProps> = ({ question, audioBase64 }) => {
    return (
        <Card className="w-70">
            <CardHeader>
                <CardTitle>{question}</CardTitle>
            </CardHeader>
            <div className="w-full flex justify-center">
                {audioBase64 && (
                    <audio controls src={`data:audio/wav;base64,${audioBase64}`} />
                )}
            </div>
        </Card>
    );
};
export default VoiceCard;
