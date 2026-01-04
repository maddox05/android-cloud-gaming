import "./Pages.css";

export default function About() {
  return (
    <div className="page-container">
      <div className="page-content">
        <h1>About MaddoxCloud</h1>

        <section className="page-section">
          <h2>Our Story</h2>
          <p>
            Hi, I'm Maddox Schmidlkofer, the creator of MaddoxCloud. I'm a Computer Science
            student at Purdue University with about 5 years of coding experience.
          </p>
          <p>
            I built MaddoxCloud because I love playing mobile games and wanted a way to
            play them on my laptop. There's something frustrating about having amazing games
            on your phone but not being able to enjoy them on a bigger screen with better
            controls. So I decided to build a solution myself.
          </p>
        </section>

        <section className="page-section">
          <h2>The Vision</h2>
          <p>
            MaddoxCloud is designed to make cloud gaming simple and accessible. Play your
            favorite Android games from any browser, anywhere, anytime. No need for expensive
            hardware or complex setups - just open your browser and start playing.
          </p>
          <p>
            I believe in building products that I personally want to use. I don't want to
            work on something I don't care about - I want to do something great. MaddoxCloud
            is my way of combining my passion for gaming with my skills in software development.
          </p>
        </section>

        <section className="page-section">
          <h2>About Me</h2>
          <p>
            When I'm not coding, you can find me mountain biking, target shooting, hiking,
            playing soccer, or spending time with my girlfriend. I'm driven by personal
            fulfillment and the satisfaction of seeing people use something I've created.
          </p>
          <p>
            My first notable project was a recoil-reduction script written in Rust. What I
            found most satisfying wasn't just seeing it work, but watching my friends
            actually use it. That experience taught me the joy of building things that
            help others.
          </p>
        </section>

        <section className="page-section">
          <h2>Connect With Me</h2>
          <p>
            Feel free to reach out or follow my journey:
          </p>
          <ul className="page-list">
            <li><a href="https://maddox.page" target="_blank" rel="noopener noreferrer">Personal Website</a></li>
            <li><a href="https://linkedin.com/in/maddox-schmidlkofer" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
            <li><a href="https://github.com/maddox05" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="https://x.com/_maddox1337" target="_blank" rel="noopener noreferrer">X (Twitter)</a></li>
          </ul>
        </section>

        <section className="page-section">
          <h2>Contact</h2>
          <p>
            Have questions, feedback, or just want to say hi? Reach out at{" "}
            <a href="mailto:contact@maddoxcloud.com">contact@maddoxcloud.com</a> or join
            our <a href="https://discord.gg/U4QYdzXEnr" target="_blank" rel="noopener noreferrer">Discord community</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
