import Image from "next/image";
import FadeInOnView from "@/components/FadeInOnView";
import Link from "next/link";
import CreateDateDialog from "@/components/CreateDateDialog";

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
    audioUrl?: string;
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

export default function Page() {
    const you = users.find((u) => u.userId === "eric22")!;
    return (
        <div>
            <h1 className="m-5 text-center font-bold">Matches</h1>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {users.map((u, idx) => {
                    const primary = getPrimaryPhoto(u.photos);
                    return (
                        <FadeInOnView key={u._id} delayMs={idx * 80}>
                            <Link href={`/matches/${u.userId}`} className="block">
                                <div className="mt-5 overflow-hidden rounded-xl">
                                    <div className="relative aspect-[4/5] w-full">
                                        <div className="absolute top-3 right-3 z-10">
                                            <CreateDateDialog you={you} match={u} label="Create Date" />
                                        </div>
                                        {primary ? (
                                            <Image
                                                alt={`${u.name} profile photo`}
                                                src={primary.url}
                                                fill
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                                priority={idx === 0}
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 bg-muted" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                            <h1 className="font-bold drop-shadow">{u.name}</h1>
                                            <p className="mt-1 text-sm drop-shadow">
                                                {u.voiceProfile.personalityProfile}
                                            </p>
                                            {u.interests?.length ? (
                                                <p className="mt-2 text-xs opacity-90">
                                                    Interests: {u.interests.join(", ")}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </FadeInOnView>
                    );
                })}
            </div>
        </div>
    );
}
