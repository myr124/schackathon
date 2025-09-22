import Image from "next/image";
import FadeInOnView from "@/components/FadeInOnView";
import CreateDateDialog from "@/components/CreateDateDialog";
import RecordedPrompts from "@/components/RecordedPrompts";

// Inline mock data mirroring matches/page.tsx
type GeoPoint = {
    type: "Point";
    coordinates: [number, number];
};
type Photo = { url: string; order: number };
type Prompt = { text: string; audioUrl?: string };
type VoiceProfile = { prompts: Prompt[]; personalityProfile: string };
type UserDoc = {
    _id: string;
    userId: string;
    name: string;
    email: string;
    location: GeoPoint;
    photos: Photo[];
    voiceProfile: VoiceProfile;
    interests: string[];
    friends: string[];
};

const users: UserDoc[] = [
    {
        _id: "6740c3a8f1c2a1bde0000001",
        userId: "eric22",
        name: "Eric",
        email: "eric@example.com",
        location: { type: "Point", coordinates: [-73.935242, 40.73061] },
        photos: [
            { url: "https://randomuser.me/api/portraits/men/32.jpg", order: 0 },
            { url: "https://randomuser.me/api/portraits/men/12.jpg", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Introduce yourself in one sentence." },
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
            { url: "https://randomuser.me/api/portraits/women/68.jpg", order: 0 },
            { url: "https://randomuser.me/api/portraits/women/22.jpg", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "What are you passionate about?" },
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
            { url: "https://randomuser.me/api/portraits/men/45.jpg", order: 1 },
            { url: "https://randomuser.me/api/portraits/men/37.jpg", order: 0 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Tell me about your ideal weekend." },
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
            { url: "https://randomuser.me/api/portraits/women/47.jpg", order: 0 },
            { url: "https://randomuser.me/api/portraits/women/14.jpg", order: 2 },
            { url: "https://randomuser.me/api/portraits/women/55.jpg", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Describe a memorable trip." },
            ],
            personalityProfile:
                "Art lover and amateur photographer. Big on music festivals and spontaneous road trips.",
        },
        interests: ["art", "photography", "music"],
        friends: [],
    },
    {
        _id: "6740c3a8f1c2a1bde0000005",
        userId: "liam26",
        name: "Liam",
        email: "liam@example.com",
        location: { type: "Point", coordinates: [-71.0589, 42.3601] },
        photos: [
            { url: "https://randomuser.me/api/portraits/men/28.jpg", order: 0 },
            { url: "https://randomuser.me/api/portraits/men/83.jpg", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "What's your perfect Saturday?" },
            ],
            personalityProfile:
                "Foodie and weekend cyclist. Loves live music and discovering neighborhood gems.",
        },
        interests: ["cycling", "food", "live music"],
        friends: ["eric22"],
    },
    {
        _id: "6740c3a8f1c2a1bde0000006",
        userId: "zoe20",
        name: "Zoe",
        email: "zoe@example.com",
        location: { type: "Point", coordinates: [-122.3321, 47.6062] },
        photos: [
            { url: "https://randomuser.me/api/portraits/women/62.jpg", order: 0 },
            { url: "https://randomuser.me/api/portraits/women/19.jpg", order: 1 },
        ],
        voiceProfile: {
            prompts: [
                { text: "Share a favorite travel memory." },
            ],
            personalityProfile:
                "Curious traveler and coffee shop connoisseur. Into art exhibits and cozy bookstores.",
        },
        interests: ["travel", "art", "coffee", "books"],
        friends: ["mia21"],
    },
];

function getPrimaryPhoto(photos: Photo[]): Photo | undefined {
    if (!photos?.length) return undefined;
    return [...photos].sort((a, b) => a.order - b.order)[0];
}

export default async function MatchDetailPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params;
    const user = users.find((u) => u.userId === userId);
    const you = users.find((u) => u.userId === "eric22")!;

    if (!user) {
        return (
            <main className="container mx-auto px-4 py-10">
                <h1 className="font-semibold">Profile not found</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    We couldn't find that match profile.
                </p>
            </main>
        );
    }

    const primary = getPrimaryPhoto(user.photos);

    return (
        <main className="container mx-auto px-4 py-8">
            {/* Hero full-bleed card similar to Matches grid cards */}
            <div className="overflow-hidden rounded-xl">
                <div className="relative aspect-[4/5] w-full">
                    <div className="absolute top-3 right-3 z-10">
                        <CreateDateDialog you={you} match={user} label="Create Date" />
                    </div>
                    {primary ? (
                        <Image
                            alt={`${user.name} profile photo`}
                            src={primary.url}
                            fill
                            sizes="100vw"
                            quality={75}
                            priority
                            className="object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-muted" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h1 className="font-bold drop-shadow">{user.name}</h1>
                        <p className="mt-1 text-sm drop-shadow">
                            {user.voiceProfile.personalityProfile}
                        </p>
                        {user.interests?.length ? (
                            <p className="mt-2 text-xs opacity-90">
                                Interests: {user.interests.join(", ")}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Recorded Q&A sections: use signed-in user's recordings when viewing own profile; fallback to static prompts for others */}
            <RecordedPrompts viewedUserId={user.userId} staticPrompts={user.voiceProfile.prompts} />
        </main>
    );
}
