import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import {useRef} from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

function HomeSection({ scrollYProgress }) {
  return (
    <div className={`bg-[#fff] flex flex-col w-full items-center`}>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "tween", delay: 0.3, duration: 0.5 }}
        className="flex flex-col items-center h-[70vh] justify-center gap-[34px]">
        {/*Home section content including btn*/}
        <h1 className="section--heading text-[4rem] font-bold text-center leading-[4rem] text-[#242424]">
          Peer to Peer tunnels for
          <br /> Instant Access
        </h1>
        <p className="section--para text-center text-[#525252]">
          Create P2P tunnels instantly that bypass any{" "}
          <strong className="text-[#e94e47]">
            network, firewall, NAT restrictions
            <br />
            and expose
          </strong>{" "}
          your local network to the interent securely,
          <br />
          no Dynamic DNS required.
        </p>
        <span className="flex flex-col items-center gap-[10px]">
          <button className="button bg-[#E94E47] text-[#fff] border-[#000]">
            Get Started
          </button>
          <p className="section--para text-center text-[#242424]">
            It is 100% <b className="text-[#e94e47] font-bold">Free</b> and{" "}
            <b className="text-[#e94e47] font-bold">Open Source</b>
          </p>
        </span>
      </motion.span>
      <motion.div
        style={{ scaleZ: scrollYProgress }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "tween", delay: 0.5, duration: 0.6 }}
        className="mb-[100px]">
        <img
          className="home--section--main--img w-[70vw] border-[10px] border-double shadow-[#4c4c4c] shadow-2xl border-[#fff] rounded-[50px] ring-1 ring-[#000]"
          src="/img/others/code1.png"
          alt="banner"></img>
      </motion.div>
    </div>
  );
}

function WhatWeDo() {
  return (
      <>
        <div className="what--does--it--do pb-[100px] flex flex-col px-[200px] gap-[70px]">
        <span className="flex flex-col gap-[12px]">
          <h1 className="text-[1rem] w-fit ring-1 ring-[#e94e47] bg-[#e94e4719] py-[7px] px-[30px] rounded-full">
            Features
          </h1>
          <h1 className="section--heading font-bold text-[2rem]">
            What does it do?
          </h1>
          <p>
            Enabling you to create Peer-to-Peer network tunnels securely on your
            local network.
          </p>
        </span>
          <div className="what--does--it--do--subPart flex justify-center items-center relative gap-[30px]">
          <span>
            <ul className="flex flex-col gap-[40px]">
              <li className="flex gap-[10px]">
                <img
                    className="w-[30px] h-[30px]"
                    src="img/icons/network.png"
                    alt="icons"></img>
                <span className="flex flex-col gap-[10px]">
                  <h2 className="text-[20px] font-bold">
                    Create Network Tunnels
                  </h2>
                  <p className="text-[#404040]">
                    Holesail can create Peer-to-Peer network tunnels instantly.
                    Use it to share websites, Minecraft servers, VNC connections
                    and a lot more.
                  </p>
                </span>
              </li>
              <li className="flex gap-[10px]">
                <img
                    className="w-[30px] h-[30px]"
                    src="img/icons/secure.png"
                    alt="icons"></img>
                <span className="flex flex-col gap-[10px]">
                  <h2 className="text-[20px] font-bold">Secure your Network</h2>
                  <p className="text-[#404040]">
                    Static IP address and Dynamic DNS can expose your network to
                    attackers on the internet. With Holesail, you expose only
                    the port you choose.
                  </p>
                </span>
              </li>{" "}
              <li className="flex gap-[10px]">
                <img
                    className="w-[30px] h-[30px]"
                    src="img/icons/firewall.png"
                    alt="icons"></img>
                <span className="flex flex-col gap-[10px]">
                  <h2 className="text-[20px] font-bold">Bypass any Firewall</h2>
                  <p className="text-[#404040]">
                    We use a Holepunching technique that can reliably bypass
                    almost all firewalls and NAT restrictions while creating
                    network tunnels for you..
                  </p>
                </span>
              </li>{" "}
              <li className="flex gap-[10px]">
                <img
                    className="w-[30px] h-[30px]"
                    src="img/icons/github.png"
                    alt="icons"></img>
                <span className="flex flex-col gap-[10px]">
                  <h2 className="text-[20px] font-bold">Open Source</h2>
                  <p className="text-[#404040]">
                    Giving back to the community is our way of saying thank you
                    to thousands of developers who create and share their code
                    freely.
                  </p>
                </span>
              </li>
            </ul>
          </span>
            <span className="what--we--do--img--container w-[45vw] border-[0.5px] border-[#000] rounded-md sticky top-0">
            <img src="img/others/code10.png" alt="updated--img"></img>
              {/*<video type="video/mp4" src="./holesale/holesail--vid.mp4" autoPlay loop muted></video>*/}
          </span>
          </div>
        </div>
      </>
  );
}

function HomeDetails() {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["0 1", "0.4 1"],
  });
  const scaleProgress = useTransform(scrollYProgress, [0.7, 1], [0.5, 1]);

  const springProps = useSpring(scaleProgress, {
    stiffness: 60,
    damping: 10,
    restDelta: 0.001,
  });
  return (
      <>
        <div className="h-full bg-[#fff] flex flex-col justify-center items-center text-[#000] gap-[40px] pt-[100px] pb-[100px]">
          <h1 className="section--heading text-[4rem] font-bold text-center leading-[4rem] text-[#242424]">
            Build a connection with
            <br /> security in Mind.
          </h1>
          <div className="section--heading--div flex flex-col w-[80vw] flex-wrap items-center">
          <span className="section--heading--span flex flex-col items-center gap-[20px] text-center">
            <h1 className="text-[2rem] font-[700]">
              End-to-End encrypted | Key Pair security
            </h1>
            <p className="w-[80%]">
              All connections are end-to-end encrypted with libsodium and are
              accepted only when the public and private keys match
              appropriately. This guarantees that no other peer can
              sniff your data.
            </p>
          </span>
          </div>
          <motion.div
              ref={ref}
              style={{
                scale: springProps,
                opacity: springProps,
              }}
              className="home--page--two--img flex w-[80vw] justify-between">
            <div className="flex flex-col w-[39vw] flex-wrap items-center">
              <img className="mb-[20px]" src="img/others/code7.png"></img>
              <span className="flex flex-col gap-[20px]">
              <h1 className="connection--heading text-[2rem] font-[700]">
                Holesail Core Package | Connect with peers
              </h1>
              <p>
                Holesail is a Open source peer to peer communication software
                working on top of the Holepunch technology stack. It can bypass
                almost all firewalls and NATs and securely establish a
                connection between peers.
              </p>
            </span>
            </div>
            <div className="flex flex-col w-[39vw] flex-wrap items-center">
              <img className="mb-[20px]" src="img/others/code9.png"></img>
              <span className="flex flex-col gap-[20px]">
              <h1 className="connection--heading text-[2rem] font-[700]">
                Liveports for VS Code | Share websites
              </h1>
              <p>
                Liveports is a free extension for Visual studio code that allows
                you to share your live server, react server or anything running
                live from within Visual studio code itself. It can both serve as
                a client and as a server.
              </p>
            </span>
            </div>
          </motion.div>
        </div>
      </>
  );
}

function DeveloperQuotes() {
  return (
      <div className="py-[100px] bg-[#0d111f] text-[#fff] text-center flex flex-col items-center gap-[30px]">
        <h1 className="section--heading text-[4rem] font-bold leading-[4rem]">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          "I'm on <strong className="text-[#e94e47]">localhost</strong>"
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          <br /> it's <del>not</del> now shareable.
        </h1>
        <p className="section--para w-[65%] text-[#aaa]">
          Discover the convenience and efficiency of using Holesail's{" "}
          <strong className="text-[#E94E47]">P2P tunnelling technology</strong> to
          improve your workflow and eliminate the hassle of traditional web
          hosting. Holesail creates P2P tunnels that allow you to turn your
          computer into a <strong className="text-[#E94E47]">server</strong> for
          anyone.
        </p>
        <div className="developer--list flex flex-wrap justify-center gap-[40px] w-full">
          <div className="creater--area flex justify-center py-[14px] w-[240px] border-[0.5px] border-[#3e4a6c] rounded-md bg-[#0b0d13]">
          <span className="flex items-center gap-[20px]">
            <img
                className="w-[34px] h-[34px] object-cover ring-[0.5px] ring-[#3e4a6c] rounded-full"
                src="img/dev/Utkarsh.jpg"></img>
            <span className="text-start">
              <h2 className="font-bold text-[18px]">
                Utkarsh Payal
              </h2>
              <p className="text-[15px] text-[#6270a1]">
                Creator of Holesail
              </p>
            </span>
          </span>
          </div>
          <div className="creater--area flex justify-center py-[14px] w-[240px] border-[0.5px] border-[#3e4a6c] rounded-md bg-[#0b0d13]">
          <span className="flex items-center gap-[20px]">
            <img
                className="w-[34px] h-[34px] object-cover rounded-full ring-[0.5px] ring-[#3e4a6c]"
                src="img/dev/Suryaansh.png"></img>
            <span className="text-start">
              <h2 className="font-bold text-[18px]">
                Suryaansh Singh
              </h2>
              <p className="text-[15px] text-[#6270a1]">
                Creator of Holesail
              </p>
            </span>
          </span>
          </div>
          <div className="creater--area flex justify-center py-[14px] w-[240px] border-[0.5px] border-[#3e4a6c] rounded-md bg-[#0b0d13]">
          <span className="flex items-center gap-[20px]">
            <img
                className="w-[34px] h-[34px] object-cover rounded-full ring-[0.5px] ring-[#3e4a6c]"
                src="img/dev/Rohan.jpg"></img>
            <span className="text-start">
              <h2 className="font-bold text-[18px]">
                Rohan Chaudhary
              </h2>
              <p className="text-[15px] text-[#6270a1]">
                Creator of Holesail
              </p>
            </span>
          </span>
          </div>
        </div>
      </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Description will go into a meta tag in <head />">
      <main>
        <HomeSection />
        <WhatWeDo />
        <HomeDetails />
        <DeveloperQuotes />
      </main>
    </Layout>
  );
}
