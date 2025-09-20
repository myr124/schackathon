import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

type GeoPoint = {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
};

type Photo = {
    url: string;
    order: number;
};

type Prompt = {
    text: string;
    audioUrl: string;
};

type VoiceProfile = {
    prompts: Prompt[];
    personalityProfile: string;
};

type UserDoc = {
    _id: string; // Using string here to represent an ObjectId
    userId: string;
    name: string;
    email: string;
    location: GeoPoint;
    photos: Photo[];
    voiceProfile: VoiceProfile;
    interests: string[];
    friends: string[]; // userIds of connections
};

const users: UserDoc[] = [
    {
        _id: "6740c3a8f1c2a1bde0000001",
        userId: "eric22",
        name: "Eric",
        email: "eric@example.com",
        location: { type: "Point", coordinates: [-73.935242, 40.73061] },
        photos: [
            { url: "https://media.tenor.com/VqKq93bEsIQAAAAe/you-sure-about-that.png", order: 0 },
            { url: "https://picsum.photos/seed/eric/400/400", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Introduce yourself in one sentence.", audioUrl: "/audio/eric-intro.mp3" },
            ],
            personalityProfile:
                "Tech enthusiast and weekend hiker. Into good coffee and exploring new places.",
        },
        interests: ["hiking", "music", "coffee"],
        friends: ["ava24", "noah23"],
    },
    {
        _id: "6740c3a8f1c2a1bde0000002",
        userId: "ava24",
        name: "Ava",
        email: "ava@example.com",
        location: { type: "Point", coordinates: [-118.243683, 34.052235] },
        photos: [
            { url: "https://picsum.photos/seed/ava/400/400", order: 0 },
            { url: "https://picsum.photos/seed/ava2/400/400", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "What are you passionate about?", audioUrl: "/audio/ava-passions.mp3" },
            ],
            personalityProfile:
                "Curious, outdoorsy, and into good coffee. Always down to try new food spots.",
        },
        interests: ["outdoors", "coffee", "travel"],
        friends: ["eric22"],
    },
    {
        _id: "6740c3a8f1c2a1bde0000003",
        userId: "noah23",
        name: "Noah",
        email: "noah@example.com",
        location: { type: "Point", coordinates: [-122.419418, 37.774929] },
        photos: [
            { url: "https://picsum.photos/seed/noah/400/400", order: 1 },
            { url: "https://picsum.photos/seed/noah-primary/400/400", order: 0 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Tell me about your ideal weekend.", audioUrl: "/audio/noah-weekend.mp3" },
            ],
            personalityProfile:
                "Movie nights and trail adventures. Looking for someone to join on both.",
        },
        interests: ["movies", "hiking", "tech"],
        friends: ["eric22"],
    },
    {
        _id: "6740c3a8f1c2a1bde0000004",
        userId: "mia21",
        name: "Mia",
        email: "mia@example.com",
        location: { type: "Point", coordinates: [-87.623177, 41.881832] },
        photos: [
            { url: "https://picsum.photos/seed/mia/400/400", order: 0 },
            { url: "https://picsum.photos/seed/mia2/400/400", order: 2 },
            { url: "https://picsum.photos/seed/mia1/400/400", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Describe a memorable trip.", audioUrl: "/audio/mia-trip.mp3" },
            ],
            personalityProfile:
                "Art lover and amateur photographer. Big on music festivals and spontaneous road trips.",
        },
        interests: ["art", "photography", "music"],
        friends: [],
    },
];

function getPrimaryPhoto(photos: Photo[]): Photo | undefined {
    if (!photos?.length) return undefined;
    return [...photos].sort((a, b) => a.order - b.order)[0];
}

export default function Page() {
    return (
        <div>
            <div className="m-5 text-center text-2xl font-bold">Matches</div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u) => {
                    const primary = getPrimaryPhoto(u.photos);
                    return (
                        <Card key={u._id} className="mt-5">
                            <CardContent className="flex flex-col items-center justify-center p-6">
                                {primary ? (
                                    <Image
                                        alt={`${u.name} profile photo`}
                                        className="mb-3 rounded-xl"
                                        height={200}
                                        width={200}
                                        src={primary.url}
                                    />
                                ) : (
                                    <div className="mb-3 size-[200px] rounded-xl bg-muted" />
                                )}
                                <p className="text-2xl font-bold">{u.name}</p>
                                <p className="mt-2 text-center text-lg">
                                    {u.voiceProfile.personalityProfile}
                                </p>
                                {u.interests?.length ? (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Interests: {u.interests.join(", ")}
                                    </p>
                                ) : null}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
