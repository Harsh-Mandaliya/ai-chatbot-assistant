"""The study areas the tutor covers, with a few starter questions for each."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Subject:
    id: str
    name: str
    focus: str
    starters: tuple[str, ...]


SUBJECTS: tuple[Subject, ...] = (
    Subject(
        "general",
        "All topics",
        "any area of IT and software engineering",
        (
            "What should I learn first to become a backend developer?",
            "Explain Big-O notation with simple examples.",
            "What actually happens when I type a URL into the browser?",
            "How do I prepare for a technical interview in 30 days?",
        ),
    ),
    Subject(
        "web",
        "HTML & CSS",
        "HTML, CSS, accessibility, responsive design, Flexbox and Grid",
        (
            "When should I use Flexbox and when should I use Grid?",
            "What is semantic HTML and why does it matter?",
            "How does CSS specificity work?",
            "Build a responsive navbar with only HTML and CSS.",
        ),
    ),
    Subject(
        "javascript",
        "JavaScript & TypeScript",
        "JavaScript, TypeScript, the DOM, Node.js, React and browser APIs",
        (
            "Explain closures with a real example.",
            "How does the event loop work?",
            "What is the difference between == and ===?",
            "When is TypeScript's `unknown` better than `any`?",
        ),
    ),
    Subject(
        "python",
        "Python",
        "Python, its standard library, scripting, FastAPI/Django and data tooling",
        (
            "What are Python decorators and how do I write one?",
            "List vs tuple vs set: when do I use each?",
            "Explain generators and `yield` simply.",
            "How do virtual environments work?",
        ),
    ),
    Subject(
        "languages",
        "Java, C, C++, Go & more",
        "compiled and other programming languages: Java, C, C++, C#, Go, Rust, Kotlin, PHP and more",
        (
            "What is a pointer in C, explained simply?",
            "How does garbage collection work in Java?",
            "Why do people like Go for backend services?",
            "What makes Rust's ownership model memory-safe?",
        ),
    ),
    Subject(
        "dsa",
        "Data Structures & Algorithms",
        "data structures, algorithms, complexity analysis and problem solving",
        (
            "How does binary search work? Show it in Python.",
            "Explain dynamic programming with the coin change problem.",
            "When would I use a heap?",
            "BFS vs DFS: what's the difference?",
        ),
    ),
    Subject(
        "databases",
        "Databases & SQL",
        "SQL, relational design, indexing, transactions and NoSQL databases",
        (
            "Explain the types of SQL JOINs with an example.",
            "What is database normalization?",
            "How does an index make queries faster?",
            "SQL vs NoSQL: how do I choose?",
        ),
    ),
    Subject(
        "cloud",
        "Cloud & DevOps",
        "AWS, Azure, GCP, Docker, Kubernetes, CI/CD, Linux and infrastructure as code",
        (
            "What is the difference between a container and a virtual machine?",
            "Explain Kubernetes pods, deployments and services.",
            "What are the core AWS services a beginner should know?",
            "How does a CI/CD pipeline work?",
        ),
    ),
    Subject(
        "ai",
        "AI & Machine Learning",
        "machine learning, deep learning, neural networks, NLP, LLMs and the maths behind them",
        (
            "What is the difference between AI, ML and deep learning?",
            "Explain gradient descent intuitively.",
            "How does a transformer model work?",
            "Overfitting vs underfitting: how do I spot them?",
        ),
    ),
    Subject(
        "networking",
        "Networking & Security",
        "computer networks, TCP/IP, HTTP, DNS, operating systems and cybersecurity basics",
        (
            "Explain the OSI model in plain words.",
            "How does HTTPS keep data safe?",
            "TCP vs UDP: when is each used?",
            "What is SQL injection and how do I prevent it?",
        ),
    ),
    Subject(
        "design",
        "System Design",
        "system design, software architecture, APIs, scaling and design patterns",
        (
            "How would you design a URL shortener?",
            "What is a load balancer and why do we need one?",
            "Explain caching strategies simply.",
            "Monolith vs microservices: which should I start with?",
        ),
    ),
)

BY_ID = {s.id: s for s in SUBJECTS}
