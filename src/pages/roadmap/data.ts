export interface ScrumCard {
	id: string;
	title: string;
	titleEs?: string;
}

export interface BoardColumn {
	key: string;
	translationKey: string;
	cards: ScrumCard[];
}

export const boardColumns: BoardColumn[] = [
	{
		key: "idea",
		translationKey: "roadmap.idea",
		cards: [
			{ id: "SCRUM-1", title: "Setup Facebook Group" },
			{ id: "SCRUM-15", title: "Setup LinkedIn Group" },
			{
				id: "SCRUM-23",
				title: "sign-speak.com pricing/integration for clouddeelnote.org",
			},
			{ id: "SCRUM-5", title: "Create Banner for Socials" },
			{ id: "SCRUM-16", title: "Social marketing calendar & assets" },
			{ id: "SCRUM-9", title: "Book June Guests" },
			{
				id: "SCRUM-10",
				title: "Book Meow Wolf July 2027 Community Day — Santa Fe",
			},
		],
	},
	{
		key: "todo",
		translationKey: "roadmap.todo",
		cards: [
			{ id: "SCRUM-17", title: "Refine culture documentation" },
			{ id: "SCRUM-22", title: "Announce Next Volunteer Activation" },
			{ id: "SCRUM-14", title: "Book Demario for March conversation" },
			{ id: "SCRUM-7", title: "Book April Guests" },
			{ id: "SCRUM-8", title: "Book May Guests" },
			{ id: "SCRUM-20", title: "Announce Global Community Meetup" },
		],
	},
	{
		key: "inProgress",
		translationKey: "roadmap.inProgress",
		cards: [
			{
				id: "SCRUM-2",
				title: "UG Leaders: Choose Workshop title & date in March",
			},
			{ id: "SCRUM-6", title: "Book April Guests" },
		],
	},
	{
		key: "inReview",
		translationKey: "roadmap.inReview",
		cards: [],
	},
	{
		key: "done",
		translationKey: "roadmap.done",
		cards: [],
	},
];
