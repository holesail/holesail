// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "My Site",
  tagline: "Dinosaurs are cool",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://your-docusaurus-site.example.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/holesail",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "facebook", // Usually your GitHub org/user name.
  projectName: "docusaurus", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  plugins: [
    async function myPlugin(context, options) {
      return {
        name: "docusaurus-tailwindcss",
        configurePostCss(postcssOptions) {
          // Appends TailwindCSS and AutoPrefixer.
          postcssOptions.plugins.push(require("tailwindcss"));
          postcssOptions.plugins.push(require("autoprefixer"));
          return postcssOptions;
        },
      };
    },
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
              "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
              "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig: {
    // image: "img/icons/menu.png",
    navbar: {
      title: "Holesail",
      logo: {
        alt: "My Site Logo",
        src: "img/icons/holesail--logo.png",
      },
      items: [
        {
          to: "/docs/using npm",
          label: "Docs",
          position: "right", // Align to the left
        },
        {
          to: "/blog",
          label: "Blog",
          position: "right" // Align to the left
        },
        {
          href: "/get-started", // Replace '/get-started' with the actual link
          label: "Get Started", // Label for the button
          position: "right",// Align to the right
          className: "button button--primary"
        },
      ],
      hideOnScroll: true,
    },
    footer: {
      style: "light", // Change to "light" if you want a light-colored footer
      links: [
        {
          title: "COMPANY",
          items: [
            {
              label: "About",
              to: "/about",
            },
            {
              label: "Career",
              to: "/about",
            },
            {
              label: "Brand Center",
              to: "/about",
            },
            {
              label: "Blog",
              to: "/blog",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord Server",
              href: "https://stackoverflow.com/questions/tagged/docusaurus",
            },
            {
              label: "Instagram",
              href: "https://discordapp.com/invite/docusaurus",
            },
            {
              label: "Gmail",
              href: "https://twitter.com/docusaurus",
            },
            {
              label: "Contact Us",
              href: "/contactus",
            },
          ],
        },
        {
          title: "LEGAL",
          items: [
            {
              label: "Privacy Policy",
              to: "/blog",
            },
            {
              label: "Licensing",
              href: "https://github.com/facebook/docusaurus",
            },
            {
              label: "Terms & Conditions",
              href: "https://github.com/facebook/docusaurus",
            },
          ],
        },
        {
          title: "DOWNLOAD",
          items: [
            {
              label: "iOS",
              to: "/blog",
            },
            {
              label: "Android",
              href: "https://github.com/facebook/docusaurus",
            },
            {
              label: "Windows",
              href: "https://github.com/facebook/docusaurus",
            },
            {
              label: "Mac OS",
              href: "https://github.com/facebook/docusaurus",
            },
          ],
        },
      ],
      copyright:
          "Copyright © " +
          new Date().getFullYear() +
          " Holesail",
      // Your existing footer configuration...
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    customCss: require.resolve("./src/css/custom.css"), // Custom CSS
  },
};

export default config;
